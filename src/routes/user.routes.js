// src/routes/user.routes.js
import express from "express";

import {
  createUser,
  getUsers,
  getMe,
  updateMe,
  deleteUser,
  uploadMyAvatar,
  deleteMyAvatar,
} from "../controllers/user.controller.js";

import { userValidationRules } from "../middlewares/user.validator.js";
import { validateResult } from "../middlewares/validateResult.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { isAdmin } from "../middlewares/role.middleware.js";
import { uploadAvatar } from "../middlewares/upload.js";

const router = express.Router();

// 🔧 CAMBIO: pequeño logger para ver si “pasa por acá”
router.use((req, _res, next) => {
  if (req.originalUrl.includes("/users")) {
    console.log(`➡️  [USER ROUTE] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// Crear usuario
router.post("/", userValidationRules, validateResult, createUser);

// Listado (admin)
router.get("/", verifyToken, isAdmin, getUsers);

// Mi usuario
router.get("/me", verifyToken, getMe);
router.patch("/me", verifyToken, updateMe);

// Avatar (ambos métodos por si alguno lo usás desde Postman/FE)
router.post("/me/avatar", verifyToken, uploadAvatar, uploadMyAvatar);
router.patch("/me/avatar", verifyToken, uploadAvatar, uploadMyAvatar);

router.delete("/me/avatar", verifyToken, deleteMyAvatar);

// Eliminar (admin)
router.delete("/:id", verifyToken, isAdmin, deleteUser);

export default router;
