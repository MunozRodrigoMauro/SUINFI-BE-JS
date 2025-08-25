console.log("🧪 Cargando auth.routes.js...");

import express from "express";
import {
  loginUser,
  verifyEmailByToken,
  resendVerification,
} from "../controllers/auth.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { sendVerificationEmail } from "../services/mailer.js";

// 👇 DEBUG (solo dev)
import {
  debugGetUserByEmail,
  debugRegenerateToken,
} from "../controllers/auth.controller.js";

const router = express.Router();

// 📌 Login de usuario
router.post("/login", loginUser);

// 📌 Verificación de correo electrónico
router.get("/verify-email/:token", verifyEmailByToken);

// 📌 Reenviar correo de verificación
router.post("/resend-verification", resendVerification);

// 📌 Verificación de sesión (con JWT)
router.get("/verify", verifyToken, (req, res) => {
  return res.status(200).json({ user: req.user });
});

// 📌 Test de envío de mail manual
router.post("/test-mail", async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ message: "Missing 'to' field" });
    }

    const fakeToken = "TEST_TOKEN_" + Date.now();
    await sendVerificationEmail(to, fakeToken);

    return res.status(200).json({
      message: "Test email sent",
      to,
      fakeToken,
    });
  } catch (err) {
    console.error("❌ Error en /test-mail:", err);
    return res.status(500).json({ message: "Error sending test mail", error: err.message });
  }
});

/* ================= DEBUG SOLO EN DEV ================= */
if (process.env.NODE_ENV !== "production") {
  // GET /api/auth/debug-user?email=...
  router.get("/debug-user", debugGetUserByEmail);

  // POST /api/auth/debug-regenerate-token
  // { "email": "foo@bar.com", "send": true|false }
  router.post("/debug-regenerate-token", debugRegenerateToken);
}

export default router;