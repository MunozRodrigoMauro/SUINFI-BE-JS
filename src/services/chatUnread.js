// api.cuyit.com/src/services/chatUnread.js
// Helper para calcular no leídos por usuario.
// Devuelve: { total, byConversation: Map<string, number>, list: Array<{ chatId, count }> }

import mongoose from "mongoose";
import Message from "../models/Message.js";

/**
 * Calcula el resumen de mensajes no leídos para un usuario.
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<{ total: number, byConversation: Map<string, number>, list: Array<{ chatId: string, count: number }> }>}
 */
export async function getUnreadSummary(userId) {
  if (!userId) {
    return { total: 0, byConversation: new Map(), list: [] };
  }

  const uid = new mongoose.Types.ObjectId(String(userId));

  // Agrupar no leídos dirigidos al usuario por conversación
  const agg = await Message.aggregate([
    { $match: { to: uid, readAt: null } },
    { $group: { _id: "$chat", count: { $sum: 1 } } },
    { $project: { _id: 0, chatId: { $toString: "$_id" }, count: 1 } },
    { $sort: { count: -1 } },
  ]);

  const byConversation = new Map(agg.map(r => [r.chatId, r.count]));
  const total = agg.reduce((acc, r) => acc + (r.count || 0), 0);

  return { total, byConversation, list: agg };
}

/**
 * (Opcional) Utilidad para obtener solo el total plano.
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<number>}
 */
export async function getUnreadTotal(userId) {
  const { total } = await getUnreadSummary(userId);
  return total;
}
Te 