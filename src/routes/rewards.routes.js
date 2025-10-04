import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { getRewards, redeem } from "../controllers/rewards.controller.js";

const router = Router();
router.use(verifyToken);
router.get("/", getRewards);
router.post("/:id/redeem", redeem);

export default router;
