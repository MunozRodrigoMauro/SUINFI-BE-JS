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

    // Prevenir que ya exista un perfil
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

/**
 * 🟢 Obtener perfil profesional
 * GET /api/professionals
 */
// GET /api/professionals
export const getProfessionals = async (req, res) => {
    try {
      const { serviceId, categoryId } = req.query;
      const query = {};
  
      // ✅ Validamos si es un ObjectId válido (sino lo ignoramos)
      if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
        query.services = serviceId;
      }
  
      if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
        const servicesInCategory = await ServiceModel.find({ category: categoryId }, "_id");
        const serviceIds = servicesInCategory.map(service => service._id);
  
        // Solo aplicamos si hay servicios asociados
        if (serviceIds.length > 0) {
          query.services = { $in: serviceIds };
        } else {
          // ⚠️ No hay servicios en esa categoría, devolvemos vacío
          return res.json([]);
        }
      }
  
      const professionals = await ProfessionalModel.find(query)
        .populate("user", "name email phone") // Mostrar datos del usuario
        .populate({
          path: "services",
          select: "name price category",
          populate: {
            path: "category",
            select: "name"
          }
        });
  
      res.json(professionals);
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
      .populate("services", "name price") // Mostramos info de los servicios
      .populate("user", "name email");    // Info del usuario asociado

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
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(maxDistance) // en metros
        }
      }
    })
      .populate("user", "name email")
      .populate({
        path: "services",
        select: "name price category",
        populate: {
          path: "category",
          select: "name"
        }
      });

    res.status(200).json(professionals);
  } catch (error) {
    console.error("❌ Error getting nearby professionals:", error);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * 🟢 Actualizar estado de disponibilidad inmediata
 * PATCH /api/professionals/availability
 */
export const updateAvailabilityNow = async (req, res) => {
  try {
    const professionalId = req.user.id;

    // Buscamos el perfil profesional del usuario autenticado
    const professional = await ProfessionalModel.findOne({ user: professionalId });
    if (!professional) {
      return res.status(404).json({ message: "Professional profile not found" });
    }

    const { isAvailableNow } = req.body;

    if (typeof isAvailableNow !== "boolean") {
      return res.status(400).json({ message: "Field 'isAvailableNow' must be a boolean" });
    }

    await ProfessionalModel.updateOne(
      { user: professionalId },
      { isAvailableNow }
    );

    res.status(200).json({ message: "Availability updated", isAvailableNow });
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
        populate: {
          path: "category",
          select: "name"
        }
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
