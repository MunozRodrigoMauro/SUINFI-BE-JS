// src/routes/professional.routes.js
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
  uploadMyDocument,
  getDocsMeta,
  deleteMyDocument,
} from "../controllers/professional.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { patchMyProfessionalRules } from "../middlewares/professional.validator.js";
import { validateResult } from "../middlewares/validateResult.js";
import { uploadDoc } from "../middlewares/upload.js";

const router = express.Router();

// 👇 logger simple para ver si pega en este router
router.use((req, _res, next) => {
  console.log("➡️  [PRO ROUTE] hit", req.method, req.originalUrl);
  next();
});

// ⚠️ Rutas específicas primero (evita conflictos con "/:id")
router.patch("/availability", verifyToken, updateAvailabilityNow);          // NO cambia strategy
router.patch("/availability-mode", verifyToken, setAvailabilityMode);
router.put("/availability-schedule", verifyToken, updateAvailabilitySchedule); // fuerza "schedule" + sync now
router.patch("/me/location", verifyToken, updateMyLocation);

router.post("/", verifyToken, createProfessionalProfile);
router.get("/", getProfessionals);
router.get("/nearby", getNearbyProfessionals);
router.get("/available-now", getAvailableNowProfessionals);

router.get("/me", verifyToken, getMyProfessional);
router.put("/me", verifyToken, updateMyProfessional);
router.patch("/me", verifyToken, patchMyProfessionalRules, validateResult, updateMyProfessional);

router.post("/me/docs/:type", verifyToken, uploadDoc, uploadMyDocument); // :type = criminal-record | license
router.delete("/me/docs/:type", verifyToken, deleteMyDocument); // :type = criminal-record | license
router.get("/:id/docs/meta", getDocsMeta);

// ⚠️ Dejar "/:id" al final siempre
router.get("/:id", getProfessionalById);

export default router;
