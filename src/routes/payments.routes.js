import { Router } from "express";
import { createPayment } from "../controllers/payment.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", verifyToken, createPayment);

export default router;
