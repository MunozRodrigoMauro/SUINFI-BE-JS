import express from "express";
import {
  createReview,
  getMyReviews,
  getReviewsForProfessional,
  getReviewForBooking,
  getMyPendingReviews,
} from "../controllers/review.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { uploadReviewPhotos } from "../middlewares/upload.middleware.js";

const router = express.Router();

// Crear (con fotos opcionales: campo "photos")
router.post("/", verifyToken, uploadReviewPhotos.array("photos", 6), createReview);

// Mis reseñas
router.get("/me", verifyToken, getMyReviews);

// Existe reseña para un booking (seguridad: dueño del booking)
router.get("/booking/:id", verifyToken, getReviewForBooking);

// Bookings completados sin reseña (del cliente autenticado)
router.get("/my-pending", verifyToken, getMyPendingReviews);

// Reviews de un profesional (paginadas)
router.get("/professional/:id", getReviewsForProfessional);

export default router;
