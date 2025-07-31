// src/routes/booking.routes.js

import express from "express";
import {
  createBooking,
  getMyBookings,
  getAllBookings,
  getMyProfessionalBookings
} from "../controllers/booking.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Crear nueva reserva
router.post("/", verifyToken, createBooking);

// Obtener mis reservas como usuario
router.get("/my", verifyToken, getMyBookings);

// Obtener reservas de mi perfil profesional
router.get("/professional", verifyToken, getMyProfessionalBookings);

// Obtener todas las reservas (solo admins)
router.get("/", verifyToken, getAllBookings);

export default router;
