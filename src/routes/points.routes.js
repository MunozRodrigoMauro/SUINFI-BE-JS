import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { getMyPoints, getMyPointsHistory } from "../controllers/points.controller.js";

const router = Router();
router.use(verifyToken);
router.get("/me", getMyPoints);
router.get("/me/history", getMyPointsHistory);

export default router;
