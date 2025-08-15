import express from "express";
import { createAdminProfile, getAdminProfile } from "../controllers/admin.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", verifyToken, createAdminProfile);
router.get("/me", verifyToken, getAdminProfile);

export default router;