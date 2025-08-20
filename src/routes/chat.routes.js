// src/routes/chat.routes.js
import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import {
  listMyChats,
  getOrCreateWithOther,
  listMessages,
  createMessage,
  markAsRead,
  typing,
} from "../controllers/chat.controller.js";

const router = Router();

router.use(verifyToken);

router.get("/", listMyChats);
router.get("/with/:otherUserId", getOrCreateWithOther);
router.get("/:id/messages", listMessages);
router.post("/:id/messages", createMessage);
router.post("/:id/read", markAsRead);
router.post("/:id/typing", typing);

export default router;
