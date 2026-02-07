// src/controllers/chat.controller.js
import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import Professional from "../models/Professional.js";
import ProfessionalModel from "../models/Professional.js";
import Client from "../models/Client.js";
import { notifyChatMessageDeferred } from "../services/notification.service.js";

// ✅ [CAMBIO BLOCK]
import { getBlockSetsForMe, getBlockState, assertNotBlocked } from "../utils/blocks.js";

// 🆕 PUSH
import { sendPushToUser } from "../services/push.service.js";

/**
 * Helper: resolver avatar por userId
 * - 1) User.avatarUrl
 * - 2) si es professional -> Professional.avatarUrl
 * - 3) si es user -> Client.avatarUrl (si existe en tu schema; si no, no jode)
 */
async function resolveAvatarForUser(userLean) {
  if (!userLean?._id) return "";
  const base = String(userLean.avatarUrl || "").trim();
  if (base) return base;

  // Si el otro es profesional, a veces el avatar está en Professional
  if (userLean.role === "professional") {
    const prof = await Professional.findOne({ user: userLean._id }, "avatarUrl").lean();
    const a = String(prof?.avatarUrl || "").trim();
    if (a) return a;
  }

  // Si el otro es user y tu Client tiene avatarUrl (si no existe, queda vacío)
  if (userLean.role === "user") {
    const cli = await Client.findOne({ user: userLean._id }, "avatarUrl").lean();
    const a = String(cli?.avatarUrl || "").trim();
    if (a) return a;
  }

  return "";
}

/**
 * GET /api/chats
 * Lista mis chats con lastMessage y unreadCount
 */
export const listMyChats = async (req, res) => {
  const me = req.user.id;

  // ✅ [CAMBIO BLOCK] en vez de filtrar, devolvemos flags para que FE pueda mostrar y permitir desbloquear
  const { blockedByMeSet, blockedByOtherSet } = await getBlockSetsForMe(me);

  const chats = await Conversation.find({ participants: me })
    .sort({ updatedAt: -1 })
    .populate({ path: "lastMessage", select: "text createdAt from to readAt" })
    .lean();

  // map otherUser + unreadCount
  const ids = new Set();
  chats.forEach((c) =>
    c.participants.forEach((p) => {
      const pid = String(p);
      if (pid !== String(me)) ids.add(pid);
    })
  );

  const others = await User.find({ _id: { $in: [...ids] } }, "name email role avatarUrl").lean();

  // ✅ Asegurar avatarUrl aunque esté en Professional/Client
  const othersFixed = await Promise.all(
    others.map(async (u) => {
      const avatarUrl = await resolveAvatarForUser(u);
      return { ...u, avatarUrl };
    })
  );

  const map = new Map(othersFixed.map((u) => [String(u._id), u]));

  // unread por chat
  const unreadCounts = await Message.aggregate([
    { $match: { to: new mongoose.Types.ObjectId(me), readAt: null } },
    { $group: { _id: "$chat", n: { $sum: 1 } } },
  ]);
  const unreadMap = new Map(unreadCounts.map((u) => [String(u._id), u.n]));

  const items = [];
  for (const c of chats) {
    const otherId = String(c.participants.find((p) => String(p) !== String(me)));

    const blockedByMe = blockedByMeSet.has(otherId);
    const blockedByOther = blockedByOtherSet.has(otherId);

    items.push({
      _id: c._id,
      otherUser: map.get(otherId) || { _id: otherId, avatarUrl: "" },
      lastMessage: c.lastMessage
        ? {
            _id: c.lastMessage._id,
            text: c.lastMessage.text,
            from: c.lastMessage.from,
            to: c.lastMessage.to,
            createdAt: c.lastMessage.createdAt,
            readAt: c.lastMessage.readAt,
          }
        : null,
      unreadCount: unreadMap.get(String(c._id)) || 0,

      // ✅ flags extra (no rompen al FE aunque no estén tipados)
      blockedByMe,
      blockedByOther,
      block: { blockedByMe, blockedByOther },
    });
  }

  res.json(items);
};

/**
 * GET /api/chats/with/:otherUserId
 * Devuelve (o crea) la conversación con el otro usuario + mensajes recientes
 */
export const getOrCreateWithOther = async (req, res) => {
  const me = req.user.id;
  const { otherUserId } = req.params;

  if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
    return res.status(400).json({ message: "otherUserId inválido" });
  }
  if (String(otherUserId) === String(me)) {
    return res.status(400).json({ message: "No podés chatear con vos mismo" });
  }

  // ✅ [CAMBIO BLOCK] NO tiramos 403 acá: devolvemos flags para que el FE muestre “Chat bloqueado” y permita desbloquear
  const blockState = await getBlockState(me, otherUserId);

  // User del otro (incluye avatarUrl)
  const other = await User.findById(otherUserId, "name email role avatarUrl").lean();
  if (!other) return res.status(404).json({ message: "Destinatario no existe" });

  // Avatar fallback (si es profesional y en User está vacío)
  let avatarUrl = other?.avatarUrl ? String(other.avatarUrl) : "";

  if (!avatarUrl && other.role === "professional") {
    const pro = await ProfessionalModel.findOne({ user: otherUserId }, "avatarUrl").lean();
    if (pro?.avatarUrl) avatarUrl = String(pro.avatarUrl);
  }

  // Buscar o crear conversación
  let chat = await Conversation.findOne({
    participants: { $all: [me, otherUserId] },
  });

  if (!chat) {
    chat = await Conversation.create({ participants: [me, otherUserId] });
  }

  // Mensajes (asc)
  const messages = await Message.find({ chat: chat._id }).sort({ createdAt: 1 }).lean();

  return res.json({
    chat,
    messages,
    otherUser: {
      _id: other._id,
      name: other.name,
      email: other.email,
      role: other.role,
      avatarUrl, // ✅ SIEMPRE viene (aunque sea "")
    },

    // ✅ flags de bloqueo para el FE
    blockedByMe: blockState.blockedByMe,
    blockedByOther: blockState.blockedByOther,
    block: { ...blockState },
  });
};

/**
 * GET /api/chats/:id/messages?limit=&before=
 */
export const listMessages = async (req, res) => {
  const me = req.user.id;
  const { id } = req.params;
  const { limit = 50, before } = req.query;

  const chat = await Conversation.findById(id);
  if (!chat || !chat.participants.map(String).includes(String(me))) {
    return res.status(404).json({ message: "Chat no encontrado" });
  }

  // ✅ [CAMBIO BLOCK] Permitimos leer historial aunque esté bloqueado (el envío sigue bloqueado en createMessage/typing)

  const q = { chat: id };
  if (before) q.createdAt = { $lt: new Date(before) };

  const items = await Message.find(q)
    .sort({ createdAt: 1 })
    .limit(Math.min(Number(limit) || 50, 100))
    .lean();

  res.json(items);
};

/**
 * POST /api/chats/:id/messages { text }
 */
export const createMessage = async (req, res) => {
  const me = req.user.id;
  const { id } = req.params;
  const { text } = req.body || {};

  if (!text || !text.trim()) return res.status(400).json({ message: "Texto requerido" });

  const chat = await Conversation.findById(id);
  if (!chat || !chat.participants.map(String).includes(String(me))) {
    return res.status(404).json({ message: "Chat no encontrado" });
  }
  const to = chat.participants.find((p) => String(p) !== String(me));

  // ✅ [CAMBIO BLOCK] bloquear envío si hay bloqueo en cualquiera de los dos sentidos
  await assertNotBlocked(me, String(to));

  const message = await Message.create({
    chat: id,
    from: me,
    to,
    text: text.trim(),
  });

  chat.lastMessage = message._id;
  chat.lastMessageText = message.text;
  await chat.save();

  const io = req.app.get("io");
  io?.to(String(to)).emit("chat:message", { chatId: String(id), message });
  io?.to(String(me)).emit("chat:message", { chatId: String(id), message });

  const sender = await User.findById(me, "name email").lean();
  await notifyChatMessageDeferred({ messageDoc: message, sender, recipient: to });

  // 🆕 PUSH
  try {
    const fromName = sender?.name || "Nuevo mensaje";
    const msgText = message.text.length > 120 ? message.text.slice(0, 117) + "..." : message.text;

    await sendPushToUser(String(to), {
      title: fromName,
      body: msgText,
      data: { type: "message", chatId: String(id), otherUserId: String(me) },
    });
  } catch {
    // noop
  }

  res.status(201).json({ message });
};

/**
 * POST /api/chats/:id/read
 */
export const markAsRead = async (req, res) => {
  const me = req.user.id;
  const { id } = req.params;

  const chat = await Conversation.findById(id);
  if (!chat || !chat.participants.map(String).includes(String(me))) {
    return res.status(404).json({ message: "Chat no encontrado" });
  }

  // ✅ [CAMBIO BLOCK] Permitimos marcar leído aunque esté bloqueado (no permite enviar igual)

  await Message.updateMany({ chat: id, to: me, readAt: null }, { $set: { readAt: new Date() } });

  await Notification.updateMany(
    { recipient: me, type: "message", "metadata.chatId": String(id), status: "pending" },
    { $set: { status: "read", read: true } }
  );

  res.json({ ok: true });
};

/**
 * POST /api/chats/:id/typing { isTyping }
 */
export const typing = async (req, res) => {
  const me = req.user.id;
  const { id } = req.params;
  const { isTyping = false } = req.body || {};

  const chat = await Conversation.findById(id);
  if (!chat || !chat.participants.map(String).includes(String(me))) {
    return res.status(404).json({ message: "Chat no encontrado" });
  }
  const other = chat.participants.find((p) => String(p) !== String(me));

  // ✅ [CAMBIO BLOCK] no permitimos emitir typing si hay bloqueo
  await assertNotBlocked(me, String(other));

  const io = req.app.get("io");
  io?.to(String(other)).emit("chat:typing", {
    chatId: String(id),
    fromUserId: me,
    isTyping: !!isTyping,
  });

  res.json({ ok: true });
};

/*
[CAMBIOS HECHOS AQUÍ]
- Se agregó devolución de flags de bloqueo (blockedByMe/blockedByOther) en listMyChats y getOrCreateWithOther.
- Se evitó tirar 403 en lecturas (with/messages/read) para que el FE pueda mostrar historial + permitir “Desbloquear”.
- Se mantiene 403 en createMessage/typing (seguridad: no permitir contacto si hay bloqueo).
*/
