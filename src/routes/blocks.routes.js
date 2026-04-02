// src/routes/blocks.routes.js
import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import {
  blockUser,
  unblockUser,
  getBlockState,
} from "../controllers/block.controller.js";

const router = Router();

router.use(verifyToken);

// Estado (opcional para FE)
router.get("/:otherUserId/state", getBlockState);

// Bloquear / Desbloquear (esto es lo que Mobile está llamando)
router.post("/:otherUserId", blockUser);
router.delete("/:otherUserId", unblockUser);

export default router;