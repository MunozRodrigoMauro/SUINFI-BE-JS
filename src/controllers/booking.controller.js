// src/controllers/booking.controller.js
import mongoose from "mongoose";
import Professional from "../models/Professional.js";
import Service from "../models/Service.js";
import Booking from "../models/Booking.js";
import { 
  notifyBookingCreated, 
  notifyBookingCanceledByClient, 
  notifyBookingCanceledByPro 
} from "../services/notification.service.js";

const toISOFromDateTime = (date, time) => {
  if (!date || !time) return null;
  const iso = new Date(`${date}T${time}:00.000Z`);
  return isNaN(iso.getTime()) ? null : iso;
};

export const createBooking = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { professionalId, serviceId, scheduledAt, date, time, note = "", address = "" } = req.body;

    if (!professionalId || !serviceId || (!scheduledAt && !(date && time))) {
      return res.status(400).json({ message: "professionalId, serviceId y scheduledAt (o date+time) son obligatorios" });
    }
    if (!mongoose.Types.ObjectId.isValid(professionalId) || !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ message: "IDs inválidos" });
    }

    const prof = await Professional.findById(professionalId).populate("user", "name email");
    if (!prof) return res.status(404).json({ message: "Professional no encontrado" });

    const serv = await Service.findById(serviceId);
    if (!serv) return res.status(404).json({ message: "Service no encontrado" });

    const when = scheduledAt ? new Date(scheduledAt) : toISOFromDateTime(date, time);
    if (!when || isNaN(when.getTime())) {
      return res.status(400).json({ message: "Fecha/hora inválidas" });
    }

    const clash = await Booking.findOne({
      professional: prof._id,
      scheduledAt: when,
      status: { $in: ["pending", "accepted"] },
    });
    if (clash) return res.status(409).json({ message: "El profesional ya tiene una reserva en ese horario" });

    const booking = await Booking.create({
      client: clientId,
      professional: prof._id,
      service: serv._id,
      scheduledAt: when,
      note,
      address,
      status: "pending",
    });

    const populated = await Booking.findById(booking._id)
      .populate("client", "name email avatarUrl")
      .populate({ path: "professional", populate: { path: "user", select: "name email avatarUrl" } })
      .populate("service", "name price");

    // 🔔 Email inmediato al profesional por nueva reserva
    await notifyBookingCreated({ booking: populated });

    const io = req.app.get("io");
    io?.emit("booking:created", {
      bookingId: populated._id.toString(),
      professionalUserId: prof.user?._id?.toString(),
      clientUserId: clientId,
      at: new Date().toISOString(),
    });

    return res.status(201).json(populated);
  } catch (err) {
    console.error("createBooking error:", err?.message, err);
    return res.status(500).json({ message: "Server error", error: err?.message });
  }
};

export const getMyBookings = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { status, from, to } = req.query;

    const q = { client: clientId };
    if (status) q.status = status;
    if (from || to) q.scheduledAt = {};
    if (from) q.scheduledAt.$gte = new Date(from);
    if (to) q.scheduledAt.$lte = new Date(to);

    const list = await Booking.find(q)
      .sort({ scheduledAt: -1 })
      .populate({ path: "professional", populate: { path: "user", select: "name email avatarUrl" } })
      .populate("service", "name price");

    res.json(list);
  } catch (err) {
    console.error("getMyBookings error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getBookingsForMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, from, to } = req.query;

    const prof = await Professional.findOne({ user: userId });
    if (!prof) return res.status(404).json({ message: "Professional profile not found" });

    const q = { professional: prof._id };
    if (status) q.status = status;
    if (from || to) q.scheduledAt = {};
    if (from) q.scheduledAt.$gte = new Date(from);
    if (to) q.scheduledAt.$lte = new Date(to);

    const list = await Booking.find(q)
      .sort({ scheduledAt: 1 })
      .populate("client", "name email avatarUrl")
      .populate("service", "name price");

    res.json(list);
  } catch (err) {
    console.error("getBookingsForMe error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const PROFESSIONAL_ACTIONS = new Set(["accepted", "rejected", "completed"]);
const CLIENT_ACTIONS = new Set(["canceled"]);

export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const me = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Id inválido" });
    if (!status) return res.status(400).json({ message: "Estado requerido" });

    const booking = await Booking.findById(id)
      .populate({ path: "professional", populate: { path: "user", select: "name email" } })
      .populate("client", "name email")
      .populate("service", "name price");

    if (!booking) return res.status(404).json({ message: "Booking no encontrada" });

    const professionalUserId = booking.professional?.user?._id?.toString();
    const clientUserId = booking.client?._id?.toString();

    if (PROFESSIONAL_ACTIONS.has(status)) {
      if (me !== professionalUserId) return res.status(403).json({ message: "No autorizado" });
      if (status === "completed" && booking.status !== "accepted") {
        return res.status(400).json({ message: "Solo se puede completar una reserva aceptada" });
      }
    } else if (CLIENT_ACTIONS.has(status)) {
      if (me !== clientUserId) return res.status(403).json({ message: "No autorizado" });
      if (booking.status === "completed") {
        return res.status(400).json({ message: "No se puede cancelar una reserva completada" });
      }
      booking.cancelNote = typeof note === "string" ? note.trim().slice(0, 500) : "";
      booking.canceledAt = new Date();
      booking.canceledBy = me;
    } else {
      return res.status(400).json({ message: "Estado no permitido" });
    }

    // 🔒 Guardar estado previo para decidir notificaciones
    const prevStatus = booking.status;

    booking.status = status;
    await booking.save();

    // 🔔 Notificaciones por estado (solo si el pro NO había actuado)
    if (CLIENT_ACTIONS.has(status) && prevStatus === "pending") {
      await notifyBookingCanceledByClient({ booking });
    }
    if (status === "rejected") {
      await notifyBookingCanceledByPro({ booking });
    }

    const io = req.app.get("io");
    io?.emit("booking:updated", {
      bookingId: booking._id.toString(),
      status,
      professionalUserId,
      clientUserId,
      at: new Date().toISOString(),
    });

    res.json(booking);
  } catch (err) {
    console.error("updateBookingStatus error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
