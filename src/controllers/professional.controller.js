import ProfessionalModel from "../models/Professional.js";
import mongoose from "mongoose";
import ServiceModel from "../models/Service.js";

/**
 * 🟢 Crear perfil profesional
 * POST /api/professionals
 */
export const createProfessionalProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!location || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
      return res.status(400).json({ message: "Location (lng, lat) es obligatorio" });
    }

    if (userRole !== "professional") {
      return res.status(403).json({ message: "Only professionals can create profiles" });
    }

    const {
      services,
      yearsOfExperience,
      bio,
      location,
      isAvailableNow,
      availabilitySchedule,
      phone,
      showPhone
    } = req.body;

    const existing = await ProfessionalModel.findOne({ user: userId });
    if (existing) {
      return res.status(400).json({ message: "Professional profile already exists" });
    }

    const profile = new ProfessionalModel({
      user: userId,
      services,
      yearsOfExperience,
      bio,
      location,
      isAvailableNow,
      availabilitySchedule,
      phone,
      showPhone
    });

    const saved = await profile.save();

    return res.status(201).json(saved);
  } catch (error) {
    console.error("❌ Error al crear perfil:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

// controllers/professional.controller.js
export const getProfessionals = async (req, res) => {
  try {
    const { serviceId, categoryId, availableNow, page = 1, limit = 12 } = req.query;

    const query = {};

    // filtro por servicio puntual
    if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
      query.services = serviceId;
    }

    // filtro por categoría -> traducimos a lista de services
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      const servicesInCategory = await ServiceModel.find({ category: categoryId }, "_id");
      const serviceIds = servicesInCategory.map((s) => s._id);
      if (serviceIds.length > 0) {
        query.services = { $in: serviceIds };
      } else {
        return res.json({ items: [], total: 0, page: 1, pages: 1 });
      }
    }

    // filtro por disponibilidad inmediata
    if (String(availableNow) === "true") {
      query.isAvailableNow = true;
    }

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 12, 1), 50);

    const [items, total] = await Promise.all([
      ProfessionalModel.find(query)
        .populate("user", "name email phone")
        .populate({
          path: "services",
          select: "name price category",
          populate: { path: "category", select: "name" },
        })
        .sort({ isAvailableNow: -1, updatedAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      ProfessionalModel.countDocuments(query),
    ]);

    const pages = Math.max(Math.ceil(total / limitNum), 1);
    return res.json({ items, total, page: pageNum, pages });
  } catch (error) {
    console.error("❌ Error al obtener profesionales:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// 📌 Obtener un profesional por su ID
export const getProfessionalById = async (req, res) => {
  try {
    const { id } = req.params;

    const professional = await ProfessionalModel.findById(id)
      .populate("user", "name email")
      .populate({
        path: "services",
        select: "name description price category",
        populate: { path: "category", select: "name" },
      });

    if (!professional) {
      return res.status(404).json({ error: "Professional not found" });
    }

    res.status(200).json(professional);
  } catch (error) {
    console.error("❌ Error getting professional by ID:", error);
    res.status(500).json({ error: "Server error" });
  }
};


/**
 * 📍 Obtener profesionales cercanos
 * GET /api/professionals/nearby?lat=-34.6&lng=-58.4&maxDistance=5000
 */
export const getNearbyProfessionals = async (req, res) => {
  try {
    const { lat, lng, maxDistance = 5000 } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: "Latitude and longitude are required" });
    }

    const professionals = await ProfessionalModel.find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(maxDistance),
        },
      },
    })
      .populate("user", "name email")
      .populate({
        path: "services",
        select: "name price category",
        populate: { path: "category", select: "name" },
      });

    res.status(200).json(professionals);
  } catch (error) {
    console.error("❌ Error getting nearby professionals:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// PATCH /api/professionals/availability
export const updateAvailabilityNow = async (req, res) => {
  try {
    const userId = req.user.id;
    const { isAvailableNow } = req.body;

    if (typeof isAvailableNow !== "boolean") {
      return res.status(400).json({ message: "Field 'isAvailableNow' must be a boolean" });
    }

    const updated = await ProfessionalModel.findOneAndUpdate(
      { user: userId },
      { $set: { isAvailableNow, availabilityStrategy: "manual" } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Professional profile not found" });

    const io = req.app.get("io");
    io?.emit("availability:update", {
      userId: updated.user.toString(),
      isAvailableNow: updated.isAvailableNow,
      at: new Date().toISOString(),
    });

    res.status(200).json({ message: "Availability updated", isAvailableNow: updated.isAvailableNow, availabilityStrategy: updated.availabilityStrategy });
  } catch (error) {
    console.error("❌ Error updating availability:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// 📌 Obtener profesionales disponibles ahora
export const getAvailableNowProfessionals = async (req, res) => {
  try {
    const professionals = await ProfessionalModel.find({ isAvailableNow: true })
      .populate("user", "name email phone")
      .populate({
        path: "services",
        select: "name price category",
        populate: { path: "category", select: "name" },
      });

    res.status(200).json(professionals);
  } catch (error) {
    console.error("❌ Error getting available professionals:", error);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * 🟢 Actualizar horario de disponibilidad
 * PUT /api/professionals/availability-schedule
 */
export const updateAvailabilitySchedule = async (req, res) => {
  try {
    const userId = req.user.id;
    const { availabilitySchedule } = req.body;

    if (!availabilitySchedule || typeof availabilitySchedule !== "object") {
      return res.status(400).json({ error: "Invalid availabilitySchedule" });
    }

    const updated = await ProfessionalModel.findOneAndUpdate(
      { user: userId },
      { availabilitySchedule },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Professional profile not found" });
    }

    res.status(200).json({ message: "Availability updated", availabilitySchedule: updated.availabilitySchedule });
  } catch (error) {
    console.error("❌ Error updating availabilitySchedule:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// src/controllers/professional.controller.js
export const getMyProfessional = async (req, res) => {
  try {
    const userId = req.user.id;
    const doc = await ProfessionalModel
      .findOne({ user: userId })
      .populate("user", "name email");
    if (!doc) return res.status(404).json({ message: "Professional profile not found" });
    res.json(doc);
  } catch (e) {
    console.error("getMyProfessional error", e);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateMyProfessional = async (req, res) => {
  try {
    const userId = req.user.id;
    const allowed = [
      "bio", "phone", "showPhone", "services",
      "address.country", "address.state", "address.city",
      "address.street", "address.number", "address.unit", "address.postalCode",
      // si querés permitir también: "location"
    ];

    // sanitizar payload: solo campos permitidos
    const payload = {};
    for (const k of allowed) {
      const [root, sub] = k.split(".");
      if (sub) {
        if (!payload[root]) payload[root] = {};
        if (req.body?.[root]?.[sub] != null) payload[root][sub] = req.body[root][sub];
      } else if (req.body?.[root] != null) {
        payload[root] = req.body[root];
      }
    }

    const updated = await ProfessionalModel.findOneAndUpdate(
      { user: userId },
      { $set: payload },
      { new: true }
    )
      .populate("user", "name email");

    if (!updated) return res.status(404).json({ message: "Professional profile not found" });

    res.json({ message: "Professional updated", professional: updated });
  } catch (e) {
    console.error("updateMyProfessional error", e);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/professionals/availability-mode
export const setAvailabilityMode = async (req, res) => {
  try {
    const userId = req.user.id;
    const { mode } = req.body; // "manual" | "schedule"
    if (!["manual","schedule"].includes(mode)) {
      return res.status(400).json({ message: "Invalid mode" });
    }
    const updated = await ProfessionalModel.findOneAndUpdate(
      { user: userId },
      { $set: { availabilityStrategy: mode } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Professional profile not found" });
    return res.json({ message: "Mode updated", availabilityStrategy: updated.availabilityStrategy });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
};
