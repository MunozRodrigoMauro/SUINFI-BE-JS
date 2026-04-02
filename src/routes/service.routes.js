// src/routes/service.routes.js
import express from "express";
import {
  createService,
  getServices,
  suggestService,
} from "../controllers/service.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js"; // 🛡️ Protegemos si querés después
import { isAdmin } from "../middlewares/role.middleware.js";

const router = express.Router();

// 🟩 BUENA PRÁCTICA: endpoints RESTful

// Crear un nuevo servicio
router.post("/", verifyToken, isAdmin, createService); // Solo logueados ✅ Solo admin puede crear servicios

// Obtener todos los servicios disponibles
router.get("/", getServices);

// Sugerir un servicio faltante
router.post("/suggestions", verifyToken, suggestService);

export default router;