console.log("🧪 Cargando auth.routes.js...");

import express from "express"; // Importamos express para crear rutas
import { loginUser } from "../controllers/auth.controller.js"; // Importamos el controlador de login
import { verifyToken } from "../middlewares/auth.middleware.js"; // Importamos el middleware de verificación de token

const router = express.Router(); // Creamos una instancia del router

// 🟩 BUENA PRÁCTICA: Rutas separadas por tipo de entidad o funcionalidad

// Ruta POST /api/auth/login
// Esta ruta escucha cuando alguien quiere iniciar sesión
// Cuando se hace POST a /api/auth/login, ejecuta la función loginUser del controlador
router.post("/login", loginUser);

// Ruta GET /api/auth/verify
// Esta ruta escucha cuando alguien quiere verificar su sesión
// Cuando se hace GET a /api/auth/verify, ejecuta la función verifyToken del controlador
router.get("/verify", verifyToken)

export default router; // Exportamos para usar en index.js
