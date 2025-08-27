// src/controllers/professional.controller.js
import mongoose from "mongoose";
import ProfessionalModel from "../models/Professional.js";
import ServiceModel from "../models/Service.js";

/* Crear perfil profesional */
export const createProfessionalProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== "professional") {
      return res.status(403).json({ message: "Only professionals can create profiles" });
    }

    const {
      services, yearsOfExperience, bio,
      location, isAvailableNow, availabilitySchedule,
      phone, showPhone, address,
    } = req.body;

    const existing = await ProfessionalModel.findOne({ user: userId });
    if (existing) return res.status(400).json({ message: "Professional profile already exists" });

    // normalizar location {lat,lng} → GeoJSON
    let loc = location;
    if (loc && typeof loc === "object" && "lat" in loc && "lng" in loc) {
      loc = { type: "Point", coordinates: [Number(loc.lng), Number(loc.lat)] };
    }
    if (!loc || !Array.isArray(loc.coordinates) || loc.coordinates.length !== 2) {
      return res.status(400).json({ message: "Location (lng, lat) es obligatorio" });
    }

    const profile = new ProfessionalModel({
      user: userId,
      services,
      yearsOfExperience,
      bio,
      location: loc,
      isAvailableNow,
      availabilitySchedule,
      phone,
      showPhone,
      address,
    });

    const saved = await profile.save();
    return res.status(201).json(saved);
  } catch (error) {
    console.error("❌ Error al crear perfil:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

/* Helpers: siempre devolver SOLO profesionales con user existente y verificado */
function filterVerifiedWithUser(docs) {
  // cuando usamos populate + match, los que no matchean vienen con user = null
  return (docs || []).filter((p) => p?.user && p.user?.verified === true);
}

/* Listado con filtros + paginación */
export const getProfessionals = async (req, res) => {
  try {
    const { serviceId, categoryId, availableNow, page = 1, limit = 12 } = req.query;

    const query = {};

    if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
      query.services = serviceId;
    }

    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      const servicesInCategory = await ServiceModel.find({ category: categoryId }, "_id");
      const ids = servicesInCategory.map((s) => s._id);
      if (ids.length) query.services = { $in: ids };
      else return res.json({ items: [], total: 0, page: 1, pages: 1 });
    }

    if (String(availableNow) === "true") {
      query.isAvailableNow = true;
    }

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 12, 1), 50);

    const [itemsRaw, totalRaw] = await Promise.all([
      ProfessionalModel.find(query)
        .populate({ path: "user", select: "name email phone verified", match: { verified: true } })
        .populate({ path: "services", select: "name price category", populate: { path: "category", select: "name" } })
        .sort({ isAvailableNow: -1, updatedAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      ProfessionalModel.countDocuments(query),
    ]);

    const items = filterVerifiedWithUser(itemsRaw);
    const total = items.length; // solo los válidos
    const pages = Math.max(Math.ceil(total / limitNum), 1);

    return res.json({ items, total, page: pageNum, pages });
  } catch (error) {
    console.error("❌ Error al obtener profesionales:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

/* Obtener por ID */
export const getProfessionalById = async (req, res) => {
  try {
    const { id } = req.params;
    const professional = await ProfessionalModel.findById(id)
      .populate({ path: "user", select: "name email verified", match: { verified: true } })
      .populate({ path: "services", select: "name description price category", populate: { path: "category", select: "name" } });

    if (!professional || !professional.user) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json(professional);
  } catch (error) {
    console.error("❌ Error getting professional by ID:", error);
    res.status(500).json({ error: "Server error" });
  }
};

/* Cercanos por radio + filtros */
export const getNearbyProfessionals = async (req, res) => {
  try {
    const { lat, lng, maxDistance = 5000, serviceId, categoryId, availableNow } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: "Latitude and longitude are required" });

    const query = {};
    if (String(availableNow) === "true") query.isAvailableNow = true;

    if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
      query.services = serviceId;
    }

    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      const sIds = await ServiceModel.find({ category: categoryId }, "_id").then(x => x.map(s => s._id));
      query.services = sIds.length ? { $in: sIds } : "__EMPTY__";
    }
    if (query.services === "__EMPTY__") return res.json([]);

    const raw = await ProfessionalModel.find({
      ...query,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(maxDistance, 10),
        },
      },
    })
      .populate({ path: "user", select: "name email verified", match: { verified: true } })
      .populate({ path: "services", select: "name price category", populate: { path: "category", select: "name" } });

    const pros = filterVerifiedWithUser(raw);
    res.json(pros);
  } catch (err) {
    console.error("nearby error", err);
    res.status(500).json({ error: "Server error" });
  }
};

/* Disponibilidad NOW (manual) */
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
    ).populate({ path: "user", select: "verified", match: { verified: true } });

    if (!updated || !updated.user) {
      return res.status(404).json({ message: "Professional profile not found" });
    }

    const io = req.app.get("io");
    io?.emit("availability:update", {
      userId: updated.user._id.toString(),
      isAvailableNow: updated.isAvailableNow,
      at: new Date().toISOString(),
    });

    res.json({
      message: "Availability updated",
      isAvailableNow: updated.isAvailableNow,
      availabilityStrategy: updated.availabilityStrategy,
    });
  } catch (error) {
    console.error("❌ Error updating availability:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* Lista de disponibles ahora */
export const getAvailableNowProfessionals = async (_req, res) => {
  try {
    const raw = await ProfessionalModel.find({ isAvailableNow: true })
      .populate({ path: "user", select: "name email phone verified", match: { verified: true } })
      .populate({ path: "services", select: "name price category", populate: { path: "category", select: "name" } })
      .sort({ updatedAt: -1 });

    const professionals = filterVerifiedWithUser(raw);
    res.json(professionals);
  } catch (error) {
    console.error("❌ Error getting available professionals:", error);
    res.status(500).json({ error: "Server error" });
  }
};

/* Agenda semanal */
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
    ).populate({ path: "user", select: "verified", match: { verified: true } });

    if (!updated || !updated.user) {
      return res.status(404).json({ error: "Professional profile not found" });
    }
    res.json({ message: "Availability updated", availabilitySchedule: updated.availabilitySchedule });
  } catch (error) {
    console.error("❌ Error updating availabilitySchedule:", error);
    res.status(500).json({ error: "Server error" });
  }
};

/* Mi perfil profesional */
export const getMyProfessional = async (req, res) => {
  try {
    const userId = req.user.id;
    const doc = await ProfessionalModel.findOne({ user: userId })
      .populate({ path: "user", select: "name email verified", match: { verified: true } });

    if (!doc || !doc.user) {
      return res.status(404).json({ message: "Professional profile not found" });
    }
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
      "address.country","address.state","address.city","address.street","address.number","address.unit","address.postalCode",
      "address.label","address.location",
    ];

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
    ).populate({ path: "user", select: "name email verified", match: { verified: true } });

    if (!updated || !updated.user) {
      return res.status(404).json({ message: "Professional profile not found" });
    }

    res.json({ message: "Professional updated", professional: updated });
  } catch (e) {
    console.error("updateMyProfessional error", e);
    res.status(500).json({ message: "Server error" });
  }
};

export const setAvailabilityMode = async (req, res) => {
  try {
    const userId = req.user.id;
    const { mode } = req.body; // "manual" | "schedule"
    if (!["manual", "schedule"].includes(mode)) {
      return res.status(400).json({ message: "Invalid mode" });
    }
    const updated = await ProfessionalModel.findOneAndUpdate(
      { user: userId },
      { $set: { availabilityStrategy: mode } },
      { new: true }
    ).populate({ path: "user", select: "verified", match: { verified: true } });

    if (!updated || !updated.user) {
      return res.status(404).json({ message: "Professional profile not found" });
    }
    res.json({ message: "Mode updated", availabilityStrategy: updated.availabilityStrategy });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
};

/* PRO actualiza su posición (en tiempo real) */
export const updateMyLocation = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { lat, lng } = req.body;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ error: "lat/lng numéricos requeridos" });
    }

    const pro = await ProfessionalModel.findOneAndUpdate(
      { user: userId },
      { $set: { location: { type: "Point", coordinates: [lng, lat] }, lastLocationAt: new Date() } },
      { new: true }
    ).populate({ path: "user", select: "verified", match: { verified: true } });

    if (!pro || !pro.user) {
      return res.status(404).json({ error: "Professional profile not found" });
    }

    const io = req.app.get("io");
    io.emit("pro:location:update", {
      userId,
      lat,
      lng,
      at: new Date().toISOString(),
      isAvailableNow: pro?.isAvailableNow ?? false,
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("updateMyLocation error", e);
    res.status(500).json({ error: "Server error" });
  }
};