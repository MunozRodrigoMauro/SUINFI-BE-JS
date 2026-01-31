// src/utils/instant-bookings-cron.js
import cron from "node-cron";
import Booking from "../models/Booking.js";
import NotificationModel from "../models/Notification.js";
import { sendPushToUser } from "../services/push.service.js";
import { forceImmediateFallback, getFallbackConstants } from "../services/instant-bookings.service.js";

const { FALLBACK_AFTER_MS, EXPIRE_AFTER_MS } = getFallbackConstants();

// ✅ CAMBIO: expirar reservas programadas si quedan pending 24hs
const SCHEDULED_EXPIRE_AFTER_MS = 24 * 60 * 60 * 1000;

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

  if (!updated) return;

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
}

// ✅ CAMBIO: expira programadas (no inmediatas) si quedan pending por 24hs desde createdAt
async function expireScheduledBooking(io, bookingId, clientId) {
  const now = new Date();

  const updated = await Booking.findOneAndUpdate(
    { _id: bookingId, status: "pending", isImmediate: { $ne: true } },
    {
      $set: {
        status: "canceled",
        cancelNote: "Expirada por falta de respuesta.",
        canceledAt: now,
        canceledBy: null,
      },
    },
    { new: true }
  ).lean();

  if (!updated) return;

  await createCenterNotification({
    recipient: clientId,
    message: "Tu solicitud programada expiró por falta de respuesta del profesional.",
    subject: "Solicitud expirada",
    type: "booking",
    channel: "email",
    status: "pending",
    notBefore: now,
    metadata: { bookingId: String(updated._id), kind: "scheduled_expired" },
  });

  await emitToUser(io, clientId, "booking:updated", {
    id: String(updated._id),
    status: "canceled",
    at: now.toISOString(),
  });

  try {
    await sendPushToUser(String(clientId), {
      title: "Solicitud expirada",
      body: "Tu solicitud programada expiró por falta de respuesta del profesional.",
      data: { type: "booking", bookingId: String(updated._id), kind: "scheduled_expired" },
    });
  } catch {
    // noop
  }
}

export function registerInstantBookingsCron(io) {
  cron.schedule("* * * * *", async () => {
    const now = new Date();

    // 1) Asegurar expiresAt en bookings inmediatas viejas (por si existían antes del cambio)
    try {
      const missing = await Booking.find({
        isImmediate: true,
        status: "pending",
        $or: [{ "immediate.expiresAt": null }, { immediate: { $exists: false } }],
      })
        .select("_id createdAt immediate")
        .lean();

      for (const b of missing) {
        const createdAt = b?.immediate?.firstOfferedAt
          ? new Date(b.immediate.firstOfferedAt)
          : new Date(b.createdAt);
        const expiresAt = new Date(createdAt.getTime() + EXPIRE_AFTER_MS);

        try {
          await Booking.updateOne(
            { _id: b._id },
            {
              $set: {
                "immediate.firstOfferedAt": createdAt,
                "immediate.currentOfferAt": b?.immediate?.currentOfferAt || createdAt,
                "immediate.expiresAt": expiresAt,
              },
            },
            { timestamps: false }
          );
        } catch {
          // noop
        }
      }
    } catch {
      // noop
    }

    // 2) Expirar (15 min total)
    try {
      const expirable = await Booking.find({
        isImmediate: true,
        status: "pending",
        "immediate.expiresAt": { $ne: null, $lte: now },
        "immediate.expiredAt": null,
      })
        .select("_id client")
        .lean();

      for (const b of expirable) {
        await expireImmediateBooking(io, b._id, b.client);
      }
    } catch {
      // noop
    }

    // 3) Fallback (5 min desde currentOfferAt)
    try {
      const cutoff = new Date(now.getTime() - FALLBACK_AFTER_MS);

      const needsFallback = await Booking.find({
        isImmediate: true,
        status: "pending",
        "immediate.currentOfferAt": { $ne: null, $lte: cutoff },
        "immediate.expiresAt": { $ne: null, $gt: now },
      })
        .select("_id")
        .lean();

      for (const b of needsFallback) {
        await forceImmediateFallback({ io, bookingId: String(b._id) });
      }
    } catch {
      // noop
    }

    // 4) ✅ CAMBIO: Expirar reservas programadas pending si pasan 24hs sin respuesta
    try {
      const cutoffScheduled = new Date(now.getTime() - SCHEDULED_EXPIRE_AFTER_MS);

      const expirableScheduled = await Booking.find({
        status: "pending",
        isImmediate: { $ne: true },
        createdAt: { $ne: null, $lte: cutoffScheduled },
      })
        .select("_id client")
        .lean();

      for (const b of expirableScheduled) {
        await expireScheduledBooking(io, b._id, b.client);
      }
    } catch {
      // noop
    }
  });
}

/*
[CAMBIOS HECHOS AQUÍ]
- Se agregó expiración automática de reservas programadas (no inmediatas) si quedan en "pending" por más de 24hs:
  - const SCHEDULED_EXPIRE_AFTER_MS
  - helper expireScheduledBooking()
  - bloque (4) dentro del cron que busca y expira esas reservas
*/
