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
    getMyPayout,
    updateMyPayout,
  } from "../controllers/professional.controller.js";
  import { verifyToken } from "../middlewares/auth.middleware.js";
  import { patchMyProfessionalRules, payoutRules } from "../middlewares/professional.validator.js";
  import { validateResult } from "../middlewares/validateResult.js";
  import { uploadDoc } from "../middlewares/upload.js";

  const router = express.Router();

  router.use((req, _res, next) => {
    console.log("➡️  [PRO ROUTE] hit", req.method, req.originalUrl);
    next();
  });

  router.patch("/availability", verifyToken, updateAvailabilityNow);
  router.patch("/availability-mode", verifyToken, setAvailabilityMode);
  router.put("/availability-schedule", verifyToken, updateAvailabilitySchedule);
  router.patch("/me/location", verifyToken, updateMyLocation);

  router.post("/", verifyToken, createProfessionalProfile);
  router.get("/", getProfessionals);
  router.get("/nearby", getNearbyProfessionals);
  router.get("/available-now", getAvailableNowProfessionals);

  router.get("/me", verifyToken, getMyProfessional);
  router.put("/me", verifyToken, updateMyProfessional);
  router.patch("/me", verifyToken, patchMyProfessionalRules, validateResult, updateMyProfessional);

  // 📄 Docs
  router.post("/me/docs/:type", verifyToken, uploadDoc, uploadMyDocument);
  router.delete("/me/docs/:type", verifyToken, deleteMyDocument);
  router.get("/:id/docs/meta", getDocsMeta);

  // 💳 NUEVO: payout (dedicado)
  router.get("/me/payout", verifyToken, getMyPayout);
  router.patch("/me/payout", verifyToken, payoutRules, validateResult, updateMyPayout);

  // ⚠️ mantener al final
  router.get("/:id", getProfessionalById);

  export default router;
