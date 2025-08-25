import express from "express";
import {
  createProfessionalProfile,
  getProfessionals,
  getProfessionalById,
  getNearbyProfessionals,
  updateAvailabilityNow,
  getAvailableNowProfessionals,
  updateAvailabilitySchedule,
  getMyProfessional,
  updateMyProfessional,
  setAvailabilityMode,
  updateMyLocation,
} from "../controllers/professional.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { patchMyProfessionalRules } from "../middlewares/professional.validator.js";
import { validateResult } from "../middlewares/validateResult.js";

const router = express.Router();

router.post("/", verifyToken, createProfessionalProfile);
router.get("/", getProfessionals);
router.get("/nearby", getNearbyProfessionals);
router.get("/available-now", getAvailableNowProfessionals);

router.get("/me", verifyToken, getMyProfessional);
router.put("/me", verifyToken, updateMyProfessional);
router.patch("/me", verifyToken, patchMyProfessionalRules, validateResult, updateMyProfessional);

router.patch("/availability-mode", verifyToken, setAvailabilityMode);
router.patch("/me/location", verifyToken, updateMyLocation);
router.put("/availability-schedule", verifyToken, updateAvailabilitySchedule);

router.get("/:id", getProfessionalById);
router.patch("/availability", verifyToken, updateAvailabilityNow);

export default router;