import express from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { updateMe } from "../controllers/user.controller.js";
import { updateMyProfessional } from "../controllers/professional.controller.js";

const router = express.Router();

/**
 * PATCH /api/whatsapp/me
 * Actualiza el WhatsApp (y opcionalmente nationality) del USUARIO/CLIENTE.
 * Body esperado (cualquiera de estos campos):
 * {
 *   "whatsapp": { "number": "+54 9 11 1234 5678", "visible": true },
 *   "nationality": "AR"
 * }
 */
router.patch("/me", verifyToken, updateMe);

/**
 * PATCH /api/whatsapp/pro
 * Actualiza el WhatsApp (y opcionalmente nationality) del PROFESIONAL.
 * Body esperado (cualquiera de estos campos):
 * {
 *   "whatsapp": { "number": "11 1234 5678", "visible": true },
 *   "nationality": "AR"
 * }
 */
router.patch("/pro", verifyToken, updateMyProfessional);

export default router;
