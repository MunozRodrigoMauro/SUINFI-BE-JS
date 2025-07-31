// src/routes/notification.routes.js
import express from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import {
  getMyNotifications,
  markAsRead,
  createNotification
} from "../controllers/notification.controller.js";

const router = express.Router();

router.get("/", verifyToken, getMyNotifications);
router.patch("/:id/read", verifyToken, markAsRead);
router.post("/", verifyToken, createNotification);

export default router;
