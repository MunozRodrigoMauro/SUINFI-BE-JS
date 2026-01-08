// src/routes/notification.routes.js
import express from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { dispatchNow } from "../controllers/notification.controller.js";
import {
  getMyNotifications,
  markAsRead,
  createNotification,
  getUnreadCount,       // <-- nuevo
  markAllAsRead         // <-- nuevo
} from "../controllers/notification.controller.js";

const router = express.Router();

router.get("/", verifyToken, getMyNotifications);
router.get("/unread/count", verifyToken, getUnreadCount);  // nuevo
router.patch("/read-all", verifyToken, markAllAsRead);     // nuevo
router.patch("/:id/read", verifyToken, markAsRead);
router.post("/", verifyToken, createNotification);
router.post("/:id/dispatch-now", verifyToken, dispatchNow);

export default router;
