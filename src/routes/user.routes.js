// Importamos Express para crear rutas
import express from "express";

// Importamos las funciones que manejan la lógica de cada ruta
import { createUser, getUsers, getMe, updateMe, deleteUser } from "../controllers/user.controller.js";

// Importamos las validaciones y el middleware de resultado
import { userValidationRules } from "../middlewares/user.validator.js";
import { validateResult } from "../middlewares/validateResult.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { isAdmin } from "../middlewares/role.middleware.js";

// Creamos un nuevo router con la función Router de Express
// Esto nos permite definir rutas de forma modular, fuera del index.js principal
const router = express.Router(); 

// 🟩 BUENA PRÁCTICA: Mantener la lógica de rutas separada del controlador y del index

// 📌 Ruta POST /api/users
// Esta ruta se usa para crear un nuevo usuario
// Cuando se hace un POST a /api/users, se ejecuta la función createUser
// 🟩 Validamos los campos antes de ejecutar el controlador
router.post("/", userValidationRules, validateResult, createUser); 

// Ruta protegida para obtener usuarios
router.get("/", verifyToken, isAdmin, getUsers); // 🛡️ Solo con token válido ✅ Solo admin puede ver todos los usuarios

// 🧍 Ruta protegida: obtener solo tu perfil (GET /api/users/me)
router.get("/me", verifyToken, getMe); // ✅ Aquí va la nueva ruta

// 📌 Ruta protegida: actualizar tu perfil (PUT /api/users/me)
router.put("/me", verifyToken, updateMe); // ✅ Aquí va la nueva ruta

// 📌 Ruta protegida: eliminar tu perfil (DELETE /api/users/me)
router.delete("/:id", verifyToken, isAdmin, deleteUser); // ✅ Aquí va la nueva ruta

// Exportamos el router para que pueda ser usado en index.js
export default router;
