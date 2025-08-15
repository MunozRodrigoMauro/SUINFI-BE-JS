// src/controllers/booking.controller.js
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Professional from "../models/Professional.js";
import Service from "../models/Service.js";

/**
 * POST /api/bookings
 * Crea una reserva (cliente -> profesional)
 * body: { professionalId, serviceId, scheduledAt, note, address }
 */
export const createBooking = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { professionalId, serviceId, scheduledAt, note = "", address = "" } = req.body;

    if (!professionalId || !serviceId || !scheduledAt) {
      return res.status(400).json({ message: "professionalId, serviceId y scheduledAt son obligatorios" });
    }
    if (!mongoose.Types.ObjectId.isValid(professionalId) || !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ message: "IDs inválidos" });
    }

    const prof = await Professional.findById(professionalId).populate("user", "name email");
    if (!prof) return res.status(404).json({ message: "Professional no encontrado" });

    const serv = await Service.findById(serviceId);
    if (!serv) return res.status(404).json({ message: "Service no encontrado" });

    const booking = await Booking.create({
      client: clientId,
      professional: prof._id,
      service: serv._id,
      scheduledAt: new Date(scheduledAt),
      note,
      address,
      status: "pending",
    });

    const populated = await Booking.findById(booking._id)
      .populate("client", "name email")
      .populate({ path: "professional", populate: { path: "user", select: "name email" } })
      .populate("service", "name price");

    // 🔔 Notificación en vivo
    const io = req.app.get("io");
    io?.emit("booking:created", {
      bookingId: populated._id.toString(),
      professionalUserId: prof.user?._id?.toString(),
      clientUserId: clientId,
      at: new Date().toISOString(),
    });

    return res.status(201).json(populated);
  } catch (err) {
    console.error("createBooking error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/bookings/mine
 * Reservas del cliente autenticado
 */
export const getMyBookings = async (req, res) => {
  try {
    const clientId = req.user.id;
    const list = await Booking.find({ client: clientId })
      .sort({ createdAt: -1 })
      .populate({ path: "professional", populate: { path: "user", select: "name email" } })
      .populate("service", "name price");
    res.json(list);
  } catch (err) {
    console.error("getMyBookings error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/bookings/for-me
 * Reservas que le llegan al profesional autenticado
 */
export const getBookingsForMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const prof = await Professional.findOne({ user: userId });
    if (!prof) return res.status(404).json({ message: "Professional profile not found" });

    const list = await Booking.find({ professional: prof._id })
      .sort({ createdAt: -1 })
      .populate("client", "name email")
      .populate("service", "name price");

    res.json(list);
  } catch (err) {
    console.error("getBookingsForMe error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PATCH /api/bookings/:id
 * Actualiza el estado de la reserva:
 * - Profesional: "accepted" | "rejected" | "completed"
 * - Cliente: "canceled"
 */
export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // esperado
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Id inválido" });
    }

    const booking = await Booking.findById(id)
      .populate({ path: "professional", populate: { path: "user", select: "name email" } })
      .populate("client", "name email");

    if (!booking) return res.status(404).json({ message: "Booking no encontrada" });

    // Reglas de negocio
    const professionalUserId = booking.professional?.user?._id?.toString();
    const clientUserId = booking.client?._id?.toString();
    const me = user.id;

    const PROFESSIONAL_ACTIONS = new Set(["accepted", "rejected", "completed"]);
    const CLIENT_ACTIONS = new Set(["canceled"]);

    if (PROFESSIONAL_ACTIONS.has(status)) {
      // Tiene que ser el dueño profesional
      if (me !== professionalUserId) return res.status(403).json({ message: "No autorizado" });
    } else if (CLIENT_ACTIONS.has(status)) {
      // Tiene que ser el cliente
      if (me !== clientUserId) return res.status(403).json({ message: "No autorizado" });
    } else {
      return res.status(400).json({ message: "Estado no permitido" });
    }

    booking.status = status;
    await booking.save();

    // 🔔 Emitimos evento de actualización
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