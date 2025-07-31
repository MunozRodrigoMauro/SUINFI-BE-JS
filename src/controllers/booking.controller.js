import BookingModel from "../models/Booking.js";
import ProfessionalModel from "../models/Professional.js";
import ServiceModel from "../models/Service.js";

export const createBooking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { professional, service, date, notes, location } = req.body;

    if (!professional || !service || !date) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }

    const bookingDate = new Date(date);
    const now = new Date();

    if (bookingDate <= now) {
      return res.status(400).json({ error: "No se puede reservar en el pasado" });
    }

    const professionalFound = await ProfessionalModel.findById(professional);
    if (!professionalFound) {
      return res.status(404).json({ error: "Profesional no encontrado" });
    }

    const serviceFound = await ServiceModel.findById(service);
    if (!serviceFound) {
      return res.status(404).json({ error: "Servicio no encontrado" });
    }

    // 🔎 Validar que el profesional no tenga otra reserva en ese mismo horario exacto
    const existingBooking = await BookingModel.findOne({
      professional,
      date: bookingDate,
    });

    if (existingBooking) {
      return res.status(409).json({ error: "El profesional ya tiene una reserva en ese horario" });
    }

    const newBooking = new BookingModel({
      user: userId,
      professional,
      service,
      date: bookingDate,
      notes,
      location,
    });

    await newBooking.save();

    res.status(201).json({ message: "Reserva creada con éxito", booking: newBooking });
  } catch (error) {
    console.error("❌ Error al crear reserva:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};


// 📌 Obtener reservas del usuario
export const getMyBookings = async (req, res) => {
  try {
    const userId = req.user.id;

    const bookings = await BookingModel.find({ user: userId })
      .populate("professional", "description phone")
      .populate("service", "name price")
      .sort({ date: -1 });

    res.status(200).json(bookings);
  } catch (error) {
    console.error("❌ Error al obtener reservas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// 📌 Obtener todas las reservas como admin
export const getAllBookings = async (req, res) => {
  try {
    // Validamos si es admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Acceso denegado. Solo para admins" });
    }

    const bookings = await BookingModel.find()
      .populate("user", "name email")  // Datos del usuario que reservó
      .populate("professional", "description phone")  // Profesional contratado
      .populate("service", "name price") // Servicio contratado
      .sort({ date: -1 });

    res.status(200).json(bookings);
  } catch (error) {
    console.error("❌ Error al obtener todas las reservas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// 📌 Obtener reservas del profesional
export const getMyProfessionalBookings = async (req, res) => {
  try {
    const professionalId = req.user.id;

    // Verificamos si existe un perfil asociado
    const professional = await ProfessionalModel.findOne({ user: professionalId });
    if (!professional) {
      return res.status(404).json({ error: "Perfil profesional no encontrado" });
    }

    const bookings = await BookingModel.find({ professional: professional._id })
      .populate("user", "name email")
      .populate("service", "name price")
      .sort({ date: -1 });

    res.status(200).json(bookings);
  } catch (error) {
    console.error("❌ Error al obtener reservas del profesional:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};