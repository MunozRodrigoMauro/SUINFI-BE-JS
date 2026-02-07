// src/services/instant-bookings.service.js
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Professional from "../models/Professional.js";
import NotificationModel from "../models/Notification.js";
import { sendPushToUser } from "../services/push.service.js";

// ✅ [CAMBIO] BLOCKS: para evitar reasignaciones (cron/fallback) hacia profesionales bloqueados
import { getBlockedUserIds } from "../utils/blocks.js";

const FALLBACK_AFTER_MS = 5 * 60 * 1000; // 5 minutos
const EXPIRE_AFTER_MS = 15 * 60 * 1000; // 15 minutos

const LATE_MARKS_PER_STRIKE = 3;
const STRIKES_TO_SUSPEND = 3;
const SUSPEND_HOURS = 24;

function isSuspended(pro, now) {
  if (!pro) return false;
  if (!pro.instantSuspendedUntil) return false;
  const t = new Date(pro.instantSuspendedUntil).getTime();
  return t > now.getTime();
}

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeObjectIds(ids) {
  const out = [];
  const arr = Array.isArray(ids) ? ids : [];
  for (const x of arr) {
    const s = String(x);
    if (mongoose.Types.ObjectId.isValid(s)) out.push(new mongoose.Types.ObjectId(s));
  }
  return out;
}

function normalizeCriteria(rawCriteria, now) {
  const criteria = rawCriteria && typeof rawCriteria === "object" ? rawCriteria : {};
  const out = {};

  const requireCriminalRecord =
    typeof criteria.requireCriminalRecord === "boolean" ? criteria.requireCriminalRecord : true;
  out.requireCriminalRecord = requireCriminalRecord;

  out.requireLicense = typeof criteria.requireLicense === "boolean" ? criteria.requireLicense : false;

  const minAverageRating = toNumberOrNull(criteria.minAverageRating);
  out.minAverageRating = minAverageRating;

  const minReviews = toNumberOrNull(criteria.minReviews);
  out.minReviews = minReviews;

  const maxDistance = toNumberOrNull(criteria.maxDistance);
  out.maxDistance = maxDistance;

  const loc = criteria.clientLocation;
  if (
    loc &&
    typeof loc === "object" &&
    Array.isArray(loc.coordinates) &&
    loc.coordinates.length === 2 &&
    Number.isFinite(Number(loc.coordinates[0])) &&
    Number.isFinite(Number(loc.coordinates[1]))
  ) {
    out.clientLocation = {
      type: "Point",
      coordinates: [Number(loc.coordinates[0]), Number(loc.coordinates[1])],
    };
  } else {
    out.clientLocation = null;
  }

  out._now = now;

  return out;
}

function buildDocsMatch(criteria, now) {
  const and = [];

  if (criteria.requireCriminalRecord !== false) {
    // ✅ POR AHORA: alcanza con que esté subido (url) y no vencido
    and.push({ "documents.criminalRecord.url": { $exists: true, $ne: "" } });
    and.push({
      $or: [
        { "documents.criminalRecord.expiresAt": null },
        { "documents.criminalRecord.expiresAt": { $gte: now } },
      ],
    });

    // 🔒 FUTURO (activar cuando tengas backoffice):
    // and.push({ "documents.criminalRecord.status": "approved" });
  }

  if (criteria.requireLicense === true) {
    // ✅ POR AHORA: alcanza con que esté subido (url) y no vencido
    and.push({ "documents.license.url": { $exists: true, $ne: "" } });
    and.push({
      $or: [
        { "documents.license.expiresAt": null },
        { "documents.license.expiresAt": { $gte: now } },
      ],
    });

    // 🔒 FUTURO (activar cuando tengas backoffice):
    // and.push({ "documents.license.status": "approved" });
  }

  return and;
}

function buildBaseProQuery(serviceId, excludeProfessionalIds, excludeUserIds, now, criteria) {
  const q = {
    services: serviceId,
    isAvailableNow: true,
    depositEnabled: false,
    _id: { $nin: excludeProfessionalIds },
    $or: [{ instantSuspendedUntil: null }, { instantSuspendedUntil: { $lte: now } }],
  };

  // ✅ [CAMBIO] BLOCKS: excluir por userId (bloqueados)
  if (Array.isArray(excludeUserIds) && excludeUserIds.length) {
    q.user = { $nin: excludeUserIds };
  }

  const andDocs = buildDocsMatch(criteria, now);
  if (andDocs.length) {
    q.$and = Array.isArray(q.$and) ? q.$and.concat(andDocs) : andDocs;
  }

  if (criteria.minAverageRating != null) q.averageRating = { $gte: criteria.minAverageRating };
  if (criteria.minReviews != null) q.reviews = { $gte: criteria.minReviews };

  return q;
}

async function isBusyAt(proId, scheduledAt) {
  if (!proId || !scheduledAt) return false;
  const exists = await Booking.exists({
    professional: proId,
    scheduledAt,
    status: { $in: ["pending", "accepted"] },
  });
  return !!exists;
}

async function createCenterNotification(payload) {
  try {
    await NotificationModel.create(payload);
  } catch {
    // noop
  }
}

async function emitToUser(io, userId, event, payload) {
  try {
    io?.to?.(String(userId))?.emit?.(event, payload);
  } catch {
    // noop
  }
}

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

  await createCenterNotification({
    recipient: pro.user,
    message:
      nextSuspendedUntil
        ? "Se suspendió tu disponibilidad por no responder reservas inmediatas."
        : "Se registró una falta por no responder una reserva inmediata.",
    subject: "Actividad: reserva inmediata",
    type: "status",
    channel: "email",
    status: "pending",
    notBefore: now,
    metadata: {
      kind: "instant_penalty",
      bookingId: String(bookingId || ""),
      instantLateMarks: nextLate,
      instantStrikes: nextStrikes,
      instantSuspendedUntil: nextSuspendedUntil ? nextSuspendedUntil.toISOString() : null,
    },
  });

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

  await emitToUser(io, pro.user, "instant:penalty", {
    bookingId: String(bookingId || ""),
    instantLateMarks: nextLate,
    instantStrikes: nextStrikes,
    instantSuspendedUntil: nextSuspendedUntil ? nextSuspendedUntil.toISOString() : null,
    at: now.toISOString(),
  });
}

/**
 * ✅ CAMBIO UBER MATCH:
 * Selecciona el próximo profesional respetando:
 * - services + isAvailableNow
 * - NO suspendido
 * - depositEnabled=false
 * - antecedentes (criminalRecord approved y no vencido) por default
 * - license opcional
 * - cercanía si hay clientLocation + maxDistance (usa $geoNear)
 * - evita profesionales con choque de turno
 *
 * ✅ [CAMBIO] BLOCKS:
 * - excludeUserIds: evita candidatos cuyo user esté bloqueado (en cualquiera de los sentidos).
 */
export async function pickNextProfessionalForImmediate({
  serviceId,
  excludeProfessionalIds,
  excludeUserIds,
  now,
  criteria,
  scheduledAt,
}) {
  const nowDate = now instanceof Date ? now : new Date();
  const crit = normalizeCriteria(criteria, nowDate);

  const excludeProIds = normalizeObjectIds(excludeProfessionalIds || []);
  const excludeUsrIds = normalizeObjectIds(excludeUserIds || []);

  const svcId = mongoose.Types.ObjectId.isValid(String(serviceId))
    ? new mongoose.Types.ObjectId(String(serviceId))
    : null;

  if (!svcId) return null;

  const maxAttempts = 8;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let candidate = null;

    const hasGeo =
      crit.clientLocation &&
      Array.isArray(crit.clientLocation.coordinates) &&
      crit.clientLocation.coordinates.length === 2 &&
      crit.maxDistance != null &&
      crit.maxDistance > 0;

    if (hasGeo) {
      const geoQuery = buildBaseProQuery(svcId, excludeProIds, excludeUsrIds, nowDate, crit);

      const pipeline = [
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [
                Number(crit.clientLocation.coordinates[0]),
                Number(crit.clientLocation.coordinates[1]),
              ],
            },
            distanceField: "dist",
            maxDistance: Number(crit.maxDistance),
            spherical: true,
            query: geoQuery,
          },
        },
        { $sort: { dist: 1, lastActivityAt: -1, averageRating: -1, reviews: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 1,
            user: 1,
            lastActivityAt: 1,
            averageRating: 1,
            reviews: 1,
            instantSuspendedUntil: 1,
          },
        },
      ];

      const list = await Professional.aggregate(pipeline);
      if (Array.isArray(list) && list.length) {
        candidate = list[0] || null;
      }
    } else {
      const q = buildBaseProQuery(svcId, excludeProIds, excludeUsrIds, nowDate, crit);

      candidate = await Professional.findOne(q)
        .select("_id user lastActivityAt averageRating reviews instantSuspendedUntil")
        .sort({ lastActivityAt: -1, averageRating: -1, reviews: -1 })
        .lean();
    }

    if (!candidate) return null;
    if (isSuspended(candidate, nowDate)) {
      excludeProIds.push(new mongoose.Types.ObjectId(String(candidate._id)));
      continue;
    }

    const busy = await isBusyAt(candidate._id, scheduledAt);
    if (busy) {
      excludeProIds.push(new mongoose.Types.ObjectId(String(candidate._id)));
      continue;
    }

    return candidate;
  }

  return null;
}

async function expireImmediateBooking(io, bookingId, clientId) {
  const now = new Date();

  const updated = await Booking.findOneAndUpdate(
    { _id: bookingId, status: "pending", isImmediate: true, "immediate.expiredAt": null },
    {
      $set: {
        status: "canceled",
        cancelNote: "Expirada por falta de respuesta.",
        canceledAt: now,
        canceledBy: null,
        "immediate.expiredAt": now,
      },
    },
    { new: true }
  ).lean();

  if (!updated) return null;

  await createCenterNotification({
    recipient: clientId,
    message: "Tu solicitud inmediata expiró por falta de respuesta.",
    subject: "Solicitud expirada",
    type: "booking",
    channel: "email",
    status: "pending",
    notBefore: now,
    metadata: { bookingId: String(updated._id), kind: "instant_expired" },
  });

  await emitToUser(io, clientId, "instant:expired", {
    bookingId: String(updated._id),
    at: now.toISOString(),
  });

  try {
    await sendPushToUser(String(clientId), {
      title: "Solicitud expirada",
      body: "Tu solicitud inmediata expiró por falta de respuesta.",
      data: { type: "booking", bookingId: String(updated._id), kind: "instant_expired" },
    });
  } catch {
    // noop
  }

  return updated;
}

export async function forceImmediateFallback({ io, bookingId }) {
  const now = new Date();

  const booking = await Booking.findById(bookingId)
    .select("_id client professional service scheduledAt status isImmediate immediate createdAt")
    .lean();

  if (!booking) {
    return { ok: false, reason: "NOT_FOUND", toProfessionalId: null, booking: null };
  }

  if (booking.isImmediate !== true || booking.status !== "pending") {
    return { ok: false, reason: "NOT_PENDING_IMMEDIATE", toProfessionalId: null, booking };
  }

  const offered = Array.isArray(booking?.immediate?.offeredProfessionals)
    ? booking.immediate.offeredProfessionals.map((x) => String(x))
    : [];

  const currentProId = String(booking.professional);
  const excludeIds = [...new Set([...offered, currentProId])];

  const expiresAt =
    booking?.immediate?.expiresAt != null
      ? new Date(booking.immediate.expiresAt)
      : new Date(
          (booking?.immediate?.firstOfferedAt
            ? new Date(booking.immediate.firstOfferedAt).getTime()
            : new Date(booking.createdAt).getTime()) + EXPIRE_AFTER_MS
        );

  if (expiresAt.getTime() <= now.getTime()) {
    const expired = await expireImmediateBooking(io, booking._id, booking.client);
    return {
      ok: false,
      reason: "EXPIRED",
      toProfessionalId: null,
      booking: expired || booking,
    };
  }

  const criteria = booking?.immediate?.criteria || {};

  // ✅ [CAMBIO] BLOCKS: si durante la espera el cliente bloqueó o fue bloqueado, no reasignar a esos pros
  const blockedUserIds = await getBlockedUserIds(String(booking.client));

  const next = await pickNextProfessionalForImmediate({
    serviceId: booking.service,
    excludeProfessionalIds: excludeIds,
    excludeUserIds: blockedUserIds,
    now,
    criteria,
    scheduledAt: booking.scheduledAt,
  });

  if (!next?._id) {
    return { ok: false, reason: "NO_NEXT_PRO", toProfessionalId: null, booking };
  }

  await applyLateMark(io, currentProId, booking._id);

  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: "pending", professional: currentProId },
    {
      $set: {
        professional: next._id,
        "immediate.currentOfferAt": now,
        "immediate.lastFallbackAt": now,
        "immediate.expiresAt": expiresAt,
      },
      $inc: { "immediate.fallbackCount": 1 },
      $addToSet: { "immediate.offeredProfessionals": next._id },
    },
    { new: true }
  ).lean();

  if (!updated) {
    return { ok: false, reason: "RACE_UPDATE_FAILED", toProfessionalId: null, booking };
  }

  await createCenterNotification({
    recipient: next.user,
    message: "Tenés una nueva solicitud inmediata.",
    subject: "Nueva solicitud inmediata",
    type: "booking",
    channel: "email",
    status: "pending",
    notBefore: now,
    metadata: { bookingId: String(updated._id), kind: "instant_offer" },
  });

  await emitToUser(io, next.user, "instant:offer", {
    bookingId: String(updated._id),
    at: now.toISOString(),
  });

  try {
    await sendPushToUser(String(next.user), {
      title: "Nueva solicitud inmediata",
      body: "Tenés 5 minutos para aceptar.",
      data: { type: "booking", bookingId: String(updated._id), kind: "instant_offer" },
    });
  } catch {
    // noop
  }

  await createCenterNotification({
    recipient: updated.client,
    message: "No hubo respuesta. Te conectamos con otro profesional.",
    subject: "Buscando otro profesional",
    type: "booking",
    channel: "email",
    status: "pending",
    notBefore: now,
    metadata: {
      bookingId: String(updated._id),
      kind: "instant_fallback",
      fromProfessionalId: currentProId,
      toProfessionalId: String(next._id),
    },
  });

  await emitToUser(io, updated.client, "instant:fallback", {
    bookingId: String(updated._id),
    fromProfessionalId: currentProId,
    toProfessionalId: String(next._id),
    at: now.toISOString(),
  });

  try {
    await sendPushToUser(String(updated.client), {
      title: "Buscando otro profesional",
      body: "No hubo respuesta. Te conectamos con otro profesional.",
      data: {
        type: "booking",
        bookingId: String(updated._id),
        kind: "instant_fallback",
        toProfessionalId: String(next._id),
      },
    });
  } catch {
    // noop
  }

  return {
    ok: true,
    reason: "FALLBACK_OK",
    toProfessionalId: String(next._id),
    booking: updated,
  };
}

export function getFallbackConstants() {
  return { FALLBACK_AFTER_MS, EXPIRE_AFTER_MS };
}

/*
✅ [CAMBIO] BLOCKS:
- pickNextProfessionalForImmediate: nuevo parámetro excludeUserIds + filtro en query (q.user $nin).
- forceImmediateFallback (cron/fallback): calcula bloqueados del cliente y los excluye del matcher.
*/
