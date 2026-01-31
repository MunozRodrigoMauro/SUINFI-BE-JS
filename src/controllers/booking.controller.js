//src/controllers/booking.controller.js

import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Professional from "../models/Professional.js";
import Service from "../models/Service.js";
import { onBookingCompleted } from "../services/points.service.js";
// ✉️ NUEVO: notificaciones por email/cola
import {
  notifyBookingCreated,
  notifyBookingCanceledByClient,
  notifyBookingCanceledByPro,
} from "../services/notification.service.js";

// 🆕 PUSH
import { sendPushToUser } from "../services/push.service.js";

// ✅ CAMBIO UBER: usar misma lógica de matching que el cron
import { pickNextProfessionalForImmediate } from "../services/instant-bookings.service.js";

/* Utils */
const isValidId = (v) => mongoose.Types.ObjectId.isValid(String(v));
const toISOZ = (date, time) => {
  // Espera date: "YYYY-MM-DD" y time: "HH:mm" en horario local del usuario
  // El FE ya manda así; unificamos a Z para guardar.
  if (!date || !time) return null;
  return new Date(`${date}T${time}:00.000Z`);
};

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildImmediateCriteriaFromBody(body) {
  const b = body && typeof body === "object" ? body : {};
  const out = {
    clientLocation: null,
    maxDistance: null,
    requireCriminalRecord: true,
    requireLicense: false,
    minAverageRating: null,
    minReviews: null,
  };

  const requireCriminalRecord =
    typeof b.requireCriminalRecord === "boolean" ? b.requireCriminalRecord : true;
  out.requireCriminalRecord = requireCriminalRecord;

  if (typeof b.requireLicense === "boolean") out.requireLicense = b.requireLicense;

  const minAverageRating = toNumberOrNull(b.minAverageRating);
  if (minAverageRating != null) out.minAverageRating = minAverageRating;

  const minReviews = toNumberOrNull(b.minReviews);
  if (minReviews != null) out.minReviews = minReviews;

  const maxDistance = toNumberOrNull(b.maxDistance);
  if (maxDistance != null) out.maxDistance = maxDistance;

  const loc = b.clientLocation;
  if (
    loc &&
    typeof loc === "object" &&
    Number.isFinite(Number(loc.lat)) &&
    Number.isFinite(Number(loc.lng))
  ) {
    out.clientLocation = { type: "Point", coordinates: [Number(loc.lng), Number(loc.lat)] };
  }

  return out;
}

// function hasApprovedCriminalRecord(pro, now) {
//   const cr = pro?.documents?.criminalRecord;
//   if (!cr) return false;
//   if (cr.status !== "approved") return false;
//   if (!cr.expiresAt) return true;
//   const t = new Date(cr.expiresAt).getTime();
//   return t >= now.getTime();
// }

function hasApprovedCriminalRecord(pro, now) {
  const cr = pro?.documents?.criminalRecord;
  if (!cr) return false;

  // ✅ POR AHORA: alcanza con que esté subido (url) y no vencido
  if (!cr.url) return false;

  // 🔒 FUTURO (activar cuando tengas backoffice):
  // if (cr.status !== "approved") return false;

  if (!cr.expiresAt) return true;
  const t = new Date(cr.expiresAt).getTime();
  return t >= now.getTime();
}


/**
 * Regla de negocio:
 * - Si el profesional tiene `depositEnabled = true`, NO permitimos reservar directo aquí.
 *   El flujo válido es: PreBooking + pago MP → webhook crea Booking.
 * - Si `depositEnabled = false`, se permite la reserva directa y se marca:
 *     deposit.status = "not_required"
 */
export const createBooking = async (req, res) => {
  try {
    const me = req.user?.id;
    if (!me) return res.status(401).json({ message: "No autorizado" });

    const {
      professionalId: professionalIdRaw,
      serviceId,
      scheduledAt,
      date,
      time,
      note = "",
      address = "",
      isImmediate = false,
    } = req.body || {};

    const criteria = isImmediate ? buildImmediateCriteriaFromBody(req.body) : null;

    // Validación básica (422 con details.errors para friendly UX en FE)
    const errors = {};

    const wantsAutoAssign = isImmediate === true && !professionalIdRaw;

    if (!wantsAutoAssign) {
      if (!isValidId(professionalIdRaw)) errors.professionalId = "Profesional inválido";
    }

    if (!isValidId(serviceId)) errors.serviceId = "Servicio inválido";

    let when = null;
    if (scheduledAt) {
      const d = new Date(scheduledAt);
      if (isNaN(d.getTime())) errors.scheduledAt = "Fecha/hora inválidas";
      else when = d;
    } else {
      const z = toISOZ(date, time);
      if (!z || isNaN(z.getTime())) errors.scheduledAt = "Fecha/hora inválidas";
      else when = z;
    }

    if (wantsAutoAssign) {
      if (!criteria?.clientLocation) {
        errors.clientLocation = "Ubicación requerida para reserva inmediata automática";
      }
      const md = toNumberOrNull(criteria?.maxDistance);
      if (md == null || md <= 0) {
        errors.maxDistance = "maxDistance requerido (metros) para reserva inmediata automática";
      }
    }

    if (Object.keys(errors).length) {
      return res.status(422).json({ message: "Datos inválidos", errors });
    }

    const svc = await Service.findById(serviceId).select("_id").lean();
    if (!svc) return res.status(404).json({ message: "Servicio no encontrado" });

    // ✅ CAMBIO UBER: si es inmediata y NO viene professionalId, asignamos automáticamente
    let resolvedProfessionalId = professionalIdRaw ? String(professionalIdRaw) : null;

    if (wantsAutoAssign) {
      const nowPick = new Date();
      const next = await pickNextProfessionalForImmediate({
        serviceId: String(serviceId),
        excludeProfessionalIds: [],
        now: nowPick,
        criteria,
        scheduledAt: when,
      });

      if (!next?._id) {
        return res.status(409).json({ message: "No encontramos un profesional disponible ahora." });
      }
      resolvedProfessionalId = String(next._id);
    }

    // Existencias
    const pro = await Professional.findById(resolvedProfessionalId)
      .select("_id depositEnabled user services isAvailableNow instantSuspendedUntil documents")
      .lean();
    if (!pro) return res.status(404).json({ message: "Profesional no encontrado" });

    // ✅ [CAMBIO] si está suspendido, no permitimos booking inmediato hacia ese pro
    if (isImmediate === true) {
      const now = new Date();
      const until = pro.instantSuspendedUntil ? new Date(pro.instantSuspendedUntil) : null;
      if (until && until.getTime() > now.getTime()) {
        return res.status(409).json({ message: "Este profesional no está disponible en este momento." });
      }
    }

    // ✅ CAMBIO UBER: si es inmediata, antecedentes aprobados y no vencidos (obligatorio por default)
    if (isImmediate === true) {
      const now = new Date();
      const requireCr = criteria?.requireCriminalRecord !== false;
      if (requireCr) {
        // eslint-disable-next-line no-console
console.log('[immediate][criteria-check]', {
  proId: String(pro._id),
  isAvailableNow: pro.isAvailableNow,
  instantSuspendedUntil: pro.instantSuspendedUntil || null,
  criminalRecord: pro?.documents?.criminalRecord || null,
});

        const okCr = hasApprovedCriminalRecord(pro, now);
        if (!okCr) {
          return res
            .status(409)
            .json({ message: "Este profesional no cumple los requisitos para reservas inmediatas." });
        }
      }
      if (criteria?.requireLicense === true) {
        const lic = pro?.documents?.license;
        if (!lic || lic.status !== "approved") {
          return res
            .status(409)
            .json({ message: "Este profesional no cumple los requisitos para reservas inmediatas." });
        }
      }
    }

    // Guardrail: si requiere seña, esta ruta NO permite crear booking
    if (pro.depositEnabled === true) {
      return res
        .status(409)
        .json({ message: "Este profesional requiere seña. Iniciá la reserva desde el checkout." });
    }

    // Choque exacto de turno (mismo profesional, mismo horario, reserva activa)
    const busy = await Booking.exists({
      professional: resolvedProfessionalId,
      scheduledAt: when,
      status: { $in: ["pending", "accepted"] },
    });
    if (busy) {
      return res.status(409).json({ message: "Ese horario ya no está disponible." });
    }

    // Doble booking con el mismo profesional (opcional: bloquea si ya tenés una activa)
    const alreadyWithPro = await Booking.exists({
      client: me,
      professional: resolvedProfessionalId,
      status: { $in: ["pending", "accepted"] },
    });
    if (alreadyWithPro) {
      // El FE ya tiene copy amigable para 409.
      return res.status(409).json({
        message:
          "Ya tenés una reserva pendiente con este profesional. Cancelala desde “Reservas” y volvé a intentarlo.",
      });
    }

    // ✅ [CAMBIO] metadata de inmediatas (fallback 5m / expire 15m)
    const now = new Date();
    const immediateMeta = isImmediate
      ? {
          firstOfferedAt: now,
          currentOfferAt: now,
          expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
          offeredProfessionals: [resolvedProfessionalId],
          fallbackCount: 0,
          lastFallbackAt: null,
          expiredAt: null,
          // ✅ CAMBIO UBER: persistimos criterios para cron/fallback
          criteria: criteria || {
            clientLocation: null,
            maxDistance: null,
            requireCriminalRecord: true,
            requireLicense: false,
            minAverageRating: null,
            minReviews: null,
          },
        }
      : null;

    // Crear
    const doc = await Booking.create({
      client: me,
      professional: resolvedProfessionalId,
      service: serviceId,
      scheduledAt: when,
      status: "pending",
      note: String(note || "").slice(0, 1000),
      address: address || "",
      isImmediate: !!isImmediate, // [CAMBIO] siempre respetamos lo que pidió el FE
      // ✅ [CAMBIO] se guarda SLA/offer/fallback
      ...(isImmediate ? { immediate: immediateMeta } : {}),
      // ✨ Sin seña
      depositPaid: false,
      deposit: {
        status: "not_required",
        amount: 0,
        provider: "",
        paymentId: null,
        paidAt: null,
      },
    });

    // Para consistencia, devolvemos populado lo necesario
    const saved = await Booking.findById(doc._id)
      .populate({ path: "client", select: "name email" })
      .populate({
        path: "professional",
        populate: { path: "user", select: "name email avatarUrl" },
      })
      .populate({ path: "service", select: "name price" });

    // ✉️ NUEVO: encolo notificación de “nueva reserva” al profesional
    try {
      await notifyBookingCreated({ booking: saved });
    } catch {
      // noop
    }

    // 🆕 PUSH: avisar al profesional
    try {
      const proUserId = saved?.professional?.user?._id || saved?.professional?.user;
      const clientName = saved?.client?.name || "Cliente";
      const serviceName = saved?.service?.name || "Servicio";
      const title = isImmediate ? "Nueva Reserva Inmediata" : "Nueva Reserva";
      const body = `${clientName} solicitó: ${serviceName}`;
      await sendPushToUser(String(proUserId), {
        title,
        body,
        data: { type: "booking", bookingId: String(saved._id) },
      });
    } catch {
      // noop
    }

    // 🔌 Opcional (no rompe nada): avisar por Socket.IO a dashboards
    try {
      const io = req.app?.get?.("io");
      io?.emit?.("booking:created", {
        id: saved._id,
        status: saved.status,
        professional: saved?.professional?._id || saved?.professional,
        client: saved?.client?._id || saved?.client,
      });
    } catch {
      // noop
    }

    return res.status(201).json(saved);
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
};

/* === Listados usados por el FE (se conservan como los venías usando) === */

export const getMyBookings = async (req, res) => {
  try {
    const me = req.user?.id;
    if (!me) return res.status(401).json({ message: "No autorizado" });
    const { status } = req.query;

    const q = { client: me };
    if (status) q.status = status;

    const items = await Booking.find(q)
      .sort({ createdAt: -1 })
      .populate({
        path: "professional",
        populate: { path: "user", select: "name email avatarUrl" },
      })
      .populate("service", "name price");

    return res.json(items);
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
};

export const getBookingsForMe = async (req, res) => {
  try {
    const me = req.user?.id;
    if (!me) return res.status(401).json({ message: "No autorizado" });

    // Busco el perfil professional del usuario para mapear al campo booking.professional
    const mine = await Professional.findOne({ user: me }).select("_id").lean();
    if (!mine) return res.json([]); // no es pro, devuelve vacío

    const { status } = req.query;
    const q = { professional: mine._id };
    if (status) q.status = status;

    const items = await Booking.find(q)
      .sort({ createdAt: -1 })
      .populate("client", "name email")
      .populate("service", "name price");

    return res.json(items);
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * PATCH /api/bookings/:id
 * Cambios de estado mínimos:
 * - Cliente: puede cancelar (canceled) sus reservas pendientes/aceptadas.
 * - Profesional: puede aceptar/rechazar y completar.
 *   (La lógica fina de “canClientCancel / canProComplete” está en el FE; acá validamos lo esencial.)
 * Admite nota opcional: body.note (string)
 */
export const updateBookingStatus = async (req, res) => {
  try {
    const me = req.user?.id;
    if (!me) return res.status(401).json({ message: "No autorizado" });

    const id = req.params.id;
    const { status, note, cancelNote } = req.body || {};
    if (!["accepted", "rejected", "completed", "canceled", "pending"].includes(status || "")) {
      return res.status(400).json({ message: "Estado inválido" });
    }

    const bk = await Booking.findById(id)
      .populate({
        path: "professional",
        select: "user",
        populate: { path: "user", select: "_id name email" },
      })
      .populate("client", "_id name email")
      .populate("service", "name");

    if (!bk) return res.status(404).json({ message: "Reserva no encontrada" });

    const isClient = String(bk.client?._id) === String(me);
    const isPro = String(bk?.professional?.user?._id || "") === String(me);

    // Reglas básicas
    if (status === "canceled") {
      if (!isClient) return res.status(403).json({ message: "No autorizado" });
      if (!["pending", "accepted"].includes(bk.status)) {
        return res.status(400).json({ message: "No se puede cancelar en este estado" });
      }
    } else if (["accepted", "rejected"].includes(status)) {
      if (!isPro) return res.status(403).json({ message: "No autorizado" });
      if (bk.status !== "pending") {
        return res.status(400).json({ message: "La reserva no está pendiente" });
      }
    } else if (status === "completed") {
      if (!isPro) return res.status(403).json({ message: "No autorizado" });
      if (!["accepted"].includes(bk.status)) {
        return res.status(400).json({ message: "Solo se pueden completar reservas aceptadas" });
      }
    }

    // Aplicar cambios
    bk.status = status;
    const reason = (cancelNote ?? note ?? "").trim();
    if (reason) {
      bk.note = reason.slice(0, 1000); // si ya lo usás en UI
      if (status === "canceled" && isClient) {
        bk.cancelNote = reason.slice(0, 1000); // <- clave para el mail
      }
    }
    await bk.save();

    const populated = await Booking.findById(bk._id)
      .populate({
        path: "professional",
        populate: { path: "user", select: "name email avatarUrl" },
      })
      .populate("client", "name email")
      .populate("service", "name price");

    // 🔸 Acreditación de puntos al completar
    if (status === "completed") {
      try {
        await onBookingCompleted({ booking: populated });
      } catch {
        // noop
      }
    }

    // ✉️ NUEVO: notificaciones de cancelación (si aplica)
    try {
      if (status === "canceled") {
        if (isClient) {
          await notifyBookingCanceledByClient({ booking: populated });
        } else if (isPro) {
          await notifyBookingCanceledByPro({ booking: populated });
        }
      }
    } catch {
      // noop
    }

    // 🆕 PUSH: avisos por cambios de estado (sin romper el flujo)
    try {
      const clientUserId = populated?.client?._id || populated?.client;
      const proUserId = populated?.professional?.user?._id || populated?.professional?.user;

      const clientName = populated?.client?.name || "Cliente";
      const proName = populated?.professional?.user?.name || "Profesional";
      const serviceName = populated?.service?.name || "Servicio";

      if (status === "accepted") {
        await sendPushToUser(String(clientUserId), {
          title: "Reserva Aceptada",
          body: `${proName} aceptó tu reserva: ${serviceName}`,
          data: { type: "booking", bookingId: String(populated._id) },
        });
      }

      if (status === "rejected") {
        await sendPushToUser(String(clientUserId), {
          title: "Reserva Rechazada",
          body: `${proName} rechazó tu reserva: ${serviceName}`,
          data: { type: "booking", bookingId: String(populated._id) },
        });
      }

      if (status === "completed") {
        await sendPushToUser(String(clientUserId), {
          title: "Reserva Completada",
          body: `Tu reserva con ${proName} fue marcada como completada.`,
          data: { type: "booking", bookingId: String(populated._id) },
        });
      }

      if (status === "canceled") {
        // Si canceló el cliente → avisar al profesional
        if (isClient) {
          await sendPushToUser(String(proUserId), {
            title: "Reserva Cancelada",
            body: `${clientName} canceló la reserva: ${serviceName}`,
            data: { type: "booking", bookingId: String(populated._id) },
          });
        }

        // Si canceló el profesional (por reglas actuales acá no entra, pero lo dejamos por robustez)
        if (isPro) {
          await sendPushToUser(String(clientUserId), {
            title: "Reserva Cancelada",
            body: `${proName} canceló tu reserva: ${serviceName}`,
            data: { type: "booking", bookingId: String(populated._id) },
          });
        }
      }
    } catch {
      // noop
    }

    // 🔌 Opcional: evento Socket.IO para refrescar listados
    try {
      const io = req.app?.get?.("io");
      io?.emit?.("booking:updated", {
        id: populated._id,
        status: populated.status,
      });
    } catch {
      // noop
    }

    return res.json(populated);
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
};

/* ===========================
   ✅ CAMBIO: fallback manual inmediato para reservas "inmediatas"
   POST /api/bookings/:id/instant/fallback
=========================== */

const LATE_MARKS_PER_STRIKE = 3;
const STRIKES_TO_SUSPEND = 3;
const SUSPEND_HOURS = 24;

async function applyLateMark(io, professionalId, bookingId) {
  const now = new Date();

  const pro = await Professional.findById(professionalId).select(
    "_id user isAvailableNow instantLateMarks instantStrikes instantSuspendedUntil"
  );

  if (!pro) return;

  const prevLate = Number(pro.instantLateMarks || 0);
  const prevStrikes = Number(pro.instantStrikes || 0);

  let nextLate = prevLate + 1;
  let nextStrikes = prevStrikes;
  let nextSuspendedUntil = pro.instantSuspendedUntil || null;

  if (nextLate >= LATE_MARKS_PER_STRIKE) {
    nextLate = 0;
    nextStrikes = prevStrikes + 1;
  }

  if (nextStrikes >= STRIKES_TO_SUSPEND) {
    nextSuspendedUntil = new Date(now.getTime() + SUSPEND_HOURS * 60 * 60 * 1000);
  }

  const patch = {
    instantLateMarks: nextLate,
    instantStrikes: nextStrikes,
    instantLastLateAt: now,
    ...(nextStrikes !== prevStrikes ? { instantLastStrikeAt: now } : {}),
    instantSuspendedUntil: nextSuspendedUntil,
    isAvailableNow: false,
    onlineSince: null,
    lastActivityAt: now,
  };

  try {
    await Professional.updateOne({ _id: pro._id }, { $set: patch }, { timestamps: false });
  } catch {
    // noop
  }

  try {
    io?.emit?.("availability:update", {
      userId: pro.user.toString(),
      isAvailableNow: false,
      at: now.toISOString(),
    });
  } catch {
    // noop
  }

  try {
    await sendPushToUser(String(pro.user), {
      title: nextSuspendedUntil ? "Disponibilidad suspendida" : "Reserva inmediata perdida",
      body: nextSuspendedUntil
        ? "Quedaste suspendido temporalmente por no responder solicitudes."
        : "No respondiste a tiempo una solicitud inmediata.",
      data: {
        type: "status",
        kind: "instant_penalty",
        bookingId: String(bookingId || ""),
      },
    });
  } catch {
    // noop
  }

  try {
    io?.to?.(String(pro.user))?.emit?.("instant:penalty", {
      bookingId: String(bookingId || ""),
      instantLateMarks: nextLate,
      instantStrikes: nextStrikes,
      instantSuspendedUntil: nextSuspendedUntil ? nextSuspendedUntil.toISOString() : null,
      at: now.toISOString(),
    });
  } catch {
    // noop
  }
}

export const fallbackImmediateBookingNow = async (req, res) => {
  try {
    const me = req.user?.id;
    if (!me) return res.status(401).json({ message: "No autorizado" });

    const bookingId = req.params.id;
    if (!isValidId(bookingId)) return res.status(400).json({ message: "Reserva inválida" });

    const io = req.app?.get?.("io");

    const booking = await Booking.findById(bookingId)
      .select("_id client professional service scheduledAt status isImmediate immediate")
      .lean();

    if (!booking) return res.status(404).json({ message: "Reserva no encontrada" });

    if (String(booking.client) !== String(me)) {
      return res.status(403).json({ message: "No autorizado" });
    }

    if (booking.isImmediate !== true) {
      return res.status(409).json({ message: "Esta reserva no es inmediata." });
    }

    if (booking.status !== "pending") {
      return res.status(409).json({ message: "La reserva no está pendiente." });
    }

    const now = new Date();
    const offered = Array.isArray(booking?.immediate?.offeredProfessionals)
      ? booking.immediate.offeredProfessionals.map((x) => String(x))
      : [];

    const currentProId = String(booking.professional);
    const excludeIds = [...new Set([...offered, currentProId])];

    const criteria = booking?.immediate?.criteria || {};

    const next = await pickNextProfessionalForImmediate({
      serviceId: String(booking.service),
      excludeProfessionalIds: excludeIds,
      now,
      criteria,
      scheduledAt: booking.scheduledAt,
    });

    if (!next?._id) {
      return res.status(409).json({ message: "No encontramos otro profesional disponible ahora." });
    }

    // ✅ CAMBIO: penaliza al pro actual (misma regla que el cron)
    await applyLateMark(io, currentProId, booking._id);

    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: "pending", professional: currentProId },
      {
        $set: {
          professional: next._id,
          "immediate.currentOfferAt": now,
          "immediate.lastFallbackAt": now,
        },
        $inc: { "immediate.fallbackCount": 1 },
        $addToSet: { "immediate.offeredProfessionals": next._id },
      },
      { new: true }
    )
      .populate({ path: "client", select: "name email" })
      .populate({
        path: "professional",
        populate: { path: "user", select: "name email avatarUrl" },
      })
      .populate({ path: "service", select: "name price" });

    if (!updated) {
      return res.status(409).json({ message: "No se pudo reasignar en este momento." });
    }

    // ✅ CAMBIO: notificar por sockets/push (cliente y nuevo profesional)
    try {
      const clientUserId = updated?.client?._id || updated?.client;
      const proUserId = updated?.professional?.user?._id || updated?.professional?.user;

      io?.to?.(String(clientUserId))?.emit?.("instant:fallback", {
        bookingId: String(updated._id),
        fromProfessionalId: currentProId,
        toProfessionalId: String(updated.professional?._id || updated.professional),
        at: now.toISOString(),
      });

      io?.to?.(String(proUserId))?.emit?.("instant:offer", {
        bookingId: String(updated._id),
        at: now.toISOString(),
      });

      io?.emit?.("booking:updated", {
        id: updated._id,
        status: updated.status,
      });

      try {
        await sendPushToUser(String(proUserId), {
          title: "Nueva solicitud inmediata",
          body: "Tenés 5 minutos para aceptar.",
          data: { type: "booking", bookingId: String(updated._id), kind: "instant_offer" },
        });
      } catch {
        // noop
      }

      try {
        await sendPushToUser(String(clientUserId), {
          title: "Buscando otro profesional",
          body: "No hubo respuesta. Te conectamos con otro profesional.",
          data: {
            type: "booking",
            bookingId: String(updated._id),
            kind: "instant_fallback",
            toProfessionalId: String(updated.professional?._id || updated.professional),
          },
        });
      } catch {
        // noop
      }
    } catch {
      // noop
    }

    return res.json(updated);
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
};
