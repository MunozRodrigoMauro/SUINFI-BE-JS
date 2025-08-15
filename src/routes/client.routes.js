import express from "express";
import { createClientProfile, getClientProfile } from "../controllers/client.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", verifyToken, createClientProfile);
router.get("/me", verifyToken, getClientProfile);

export default router;