import express from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import {
  getOrCreateChat,
  sendMessage,
  getMessages
} from "../controllers/chat.controller.js";

const router = express.Router();

router.post("/", verifyToken, getOrCreateChat);
router.post("/message", verifyToken, sendMessage);
router.get("/messages/:chatId", verifyToken, getMessages);

export default router;
