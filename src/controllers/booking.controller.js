// src/controllers/booking.controller.js
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Professional from "../models/Professional.js";
import Service from "../models/Service.js";

// ✉️ NUEVO: notificaciones por email/cola
import {
  notifyBookingCreated,
  notifyBookingCanceledByClient,
  notifyBookingCanceledByPro,
} from "../services/notification.service.js";

/* Utils */
const isValidId = (v) => mongoose.Types.ObjectId.isValid(String(v));
const toISOZ = (date, time) => {
  // Espera date: "YYYY-MM-DD" y time: "HH:mm" en horario local del usuario
  // El FE ya manda así; unificamos a Z para guardar.
  if (!date || !time) return null;
  return new Date(`${date}T${time}:00.000Z`);
};

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
      professionalId,
      serviceId,
      scheduledAt,
      date,
      time,
      note = "",
      address = "",
      isImmediate = false
    } = req.body || {};

    // Validación básica (422 con details.errors para friendly UX en FE)
    const errors = {};
    if (!isValidId(professionalId)) errors.professionalId = "Profesional inválido";
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

    if (Object.keys(errors).length) {
      return res.status(422).json({ message: "Datos inválidos", errors });
    }

    // Existencias
    const pro = await Professional.findById(professionalId)
      .select("_id depositEnabled user services isAvailableNow")
      .lean();
    if (!pro) return res.status(404).json({ message: "Profesional no encontrado" });

    if (isImmediate && pro.isAvailableNow !== true) {
      return res.status(409).json({ message: "El profesional ya no está disponible ahora." });
    }

    const svc = await Service.findById(serviceId).select("_id").lean();
    if (!svc) return res.status(404).json({ message: "Servicio no encontrado" });

    // Guardrail: si requiere seña, esta ruta NO permite crear booking
    if (pro.depositEnabled === true) {
      return res
        .status(409)
        .json({ message: "Este profesional requiere seña. Iniciá la reserva desde el checkout." });
    }

    // Choque exacto de turno (mismo profesional, mismo horario, reserva activa)
    const busy = await Booking.exists({
      professional: professionalId,
      scheduledAt: when,
      status: { $in: ["pending", "accepted"] },
    });
    if (busy) {
      return res.status(409).json({ message: "Ese horario ya no está disponible." });
    }

    // Doble booking con el mismo profesional (opcional: bloquea si ya tenés una activa)
    const alreadyWithPro = await Booking.exists({
      client: me,
      professional: professionalId,
      status: { $in: ["pending", "accepted"] },
    });
    if (alreadyWithPro) {
      // El FE ya tiene copy amigable para 409.
      return res.status(409).json({
        message:
          "Ya tenés una reserva pendiente con este profesional. Cancelala desde “Reservas” y volvé a intentarlo.",
      });
    }

    // Crear
    const doc = await Booking.create({
      client: me,
      professional: professionalId,
      service: serviceId,
      scheduledAt: when,
      status: "pending",
      note: String(note || "").slice(0, 1000),
      address: address || "",
      isImmediate: !!isImmediate,
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
    } catch (e) {
      console.warn("notifyBookingCreated error:", e?.message || e);
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
    } catch (e) {
      // noop
    }

    return res.status(201).json(saved);
  } catch (e) {
    console.error("createBooking error:", e?.message || e);
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
  } catch (e) {
    console.error("getMyBookings error:", e?.message || e);
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
  } catch (e) {
    console.error("getBookingsForMe error:", e?.message || e);
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
      .populate({ path: "professional", select: "user", populate: { path: "user", select: "_id name email" } })
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
      bk.note = reason.slice(0, 1000);        // si ya lo usás en UI
      if (status === "canceled" && isClient) {
        bk.cancelNote = reason.slice(0, 1000); // <- clave para el mail
      }
    }
    await bk.save();

    const populated = await Booking.findById(bk._id)
      .populate({ path: "professional", populate: { path: "user", select: "name email avatarUrl" } })
      .populate("client", "name email")
      .populate("service", "name price");

    // ✉️ NUEVO: notificaciones de cancelación (si aplica)
    try {
      if (status === "canceled") {
        if (isClient) {
          await notifyBookingCanceledByClient({ booking: populated });
        } else if (isPro) {
          await notifyBookingCanceledByPro({ booking: populated });
        }
      }
    } catch (e) {
      console.warn("notifyBookingCanceled* error:", e?.message || e);
    }

    // 🔌 Opcional: evento Socket.IO para refrescar listados
    try {
      const io = req.app?.get?.("io");
      io?.emit?.("booking:updated", {
        id: populated._id,
        status: populated.status,
      });
    } catch (e) {
      // noop
    }

    return res.json(populated);
  } catch (e) {
    console.error("updateBookingStatus error:", e?.message || e);
    return res.status(500).json({ message: "Server error" });
  }
};
