import express from "express";
import { createProfessionalProfile, getProfessionals, getProfessionalById, getNearbyProfessionals, updateAvailabilityNow, getAvailableNowProfessionals, updateAvailabilitySchedule, getMyProfessional, updateMyProfessional  } from "../controllers/professional.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { patchMyProfessionalRules } from "../middlewares/professional.validator.js";
import { validateResult } from "../middlewares/validateResult.js";

const router = express.Router();

// 📌 Crear perfil profesional
router.post("/", verifyToken, createProfessionalProfile);

// 📌 Obtener perfil profesional
router.get("/", getProfessionals);

// 📌 Obtener profesionales cercanos
router.get("/nearby", getNearbyProfessionals);

// 📌 Obtener profesionales disponibles ahora
router.get("/available-now", getAvailableNowProfessionals);

// 👉 Obtener MI perfil profesional
router.get("/me", verifyToken, getMyProfessional);

// 👉 Actualizar MI perfil profesional (bio, phone, showPhone, services)
router.put("/me", verifyToken, updateMyProfessional);

// 👉 Actualizar MI perfil profesional (bio, phone, showPhone, services)
router.patch("/me", verifyToken, patchMyProfessionalRules, validateResult, updateMyProfessional);

// 📌 Obtener horario de disponibilidad
router.put("/availability-schedule", verifyToken, updateAvailabilitySchedule);

// 📌 Obtener un profesional por su ID
router.get("/:id", getProfessionalById);

// 📌 Actualizar estado de disponibilidad inmediata
router.patch("/availability", verifyToken, updateAvailabilityNow);



export default router;
