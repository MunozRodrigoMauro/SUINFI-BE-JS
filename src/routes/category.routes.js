// 📌 Importamos Express para crear el router
import express from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { isAdmin } from "../middlewares/role.middleware.js";

// 📌 Importamos los controladores que manejan la lógica de cada ruta
import {
  createCategory,
  getAllCategories,
  getCategoryBySlug,
} from "../controllers/category.controller.js";

// Creamos una nueva instancia del router de Express
const router = express.Router();

// 🟩 BUENA PRÁCTICA: Las rutas deben estar agrupadas por entidad (en este caso, "categories")

// 📍 POST /api/categories
// Crea una nueva categoría
router.post("/", verifyToken, isAdmin, createCategory);

// 📍 GET /api/categories
// Lista todas las categorías
router.get("/", getAllCategories);

// 📍 GET /api/categories/:slug
// Busca una categoría específica por su slug
router.get("/:slug", getCategoryBySlug);

// Exportamos el router para ser usado en index.js
export default router;
