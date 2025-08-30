// ...imports iguales
import mongoose from "mongoose";
import Professional from "../models/Professional.js";
import Service from "../models/Service.js";
import Booking from "../models/Booking.js";
// add: util para parsear date+time
const toISOFromDateTime = (date, time) => {
  if (!date || !time) return null;
  // Forzamos Z para UTC; si querés zona local, guardá como UTC igual
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

    // Normalizamos fecha
    const when = scheduledAt ? new Date(scheduledAt) : toISOFromDateTime(date, time);
    if (!when || isNaN(when.getTime())) {
      return res.status(400).json({ message: "Fecha/hora inválidas" });
    }

    // (opcional) prevenir doble booking mismo pro & hora exacta
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

// Listados: agregamos filtros básicos opcionales ?status=&from=&to=
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

// Transiciones permitidas + validación de rol
const PROFESSIONAL_ACTIONS = new Set(["accepted", "rejected", "completed"]);
const CLIENT_ACTIONS = new Set(["canceled"]);

export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const me = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Id inválido" });
    if (!status) return res.status(400).json({ message: "Estado requerido" });

    const booking = await Booking.findById(id)
      .populate({ path: "professional", populate: { path: "user", select: "name email" } })
      .populate("client", "name email");

    if (!booking) return res.status(404).json({ message: "Booking no encontrada" });

    const professionalUserId = booking.professional?.user?._id?.toString();
    const clientUserId = booking.client?._id?.toString();

    if (PROFESSIONAL_ACTIONS.has(status)) {
      if (me !== professionalUserId) return res.status(403).json({ message: "No autorizado" });
      // reglas adicionales: no completar si no estaba accepted
      if (status === "completed" && booking.status !== "accepted") {
        return res.status(400).json({ message: "Solo se puede completar una reserva aceptada" });
      }
    } else if (CLIENT_ACTIONS.has(status)) {
      if (me !== clientUserId) return res.status(403).json({ message: "No autorizado" });
    } else {
      return res.status(400).json({ message: "Estado no permitido" });
    }

    booking.status = status;
    await booking.save();

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
