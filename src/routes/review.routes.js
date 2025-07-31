import express from "express";
import {
  createReview,
  getMyReviews,
  getReviewsForProfessional
} from "../controllers/review.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();
// 📌 Rutas para reviews
router.post("/", verifyToken, createReview);
// 📌 Rutas para reviews del usuario
router.get("/me", verifyToken, getMyReviews);
// 📌 Rutas para reviews del profesional
router.get("/professional/:id", getReviewsForProfessional);

export default router;
