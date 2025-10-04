// src/routes/auth.routes.js
// 🛠 CAMBIO: se agregan rutas para OAuth Google (client/professional) y callback

import express from "express";
import {
  loginUser,
  verifyEmailByToken,
  resendVerification,
  requestPasswordReset,
  confirmPasswordReset,
  debugGetUserByEmail,
  debugRegenerateToken,
} from "../controllers/auth.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { sendVerificationEmail } from "../services/mailer.js";

// 🛠 CAMBIO: importar nuevo controlador OAuth
import {
  googleStartClient,
  googleStartProfessional,
  googleCallback,
} from "../controllers/oauth.controller.js";

const router = express.Router();

router.post("/login", loginUser);

router.get("/verify-email/:token", verifyEmailByToken);
router.post("/resend-verification", resendVerification);

// ✅ RESET PASSWORD (públicas)
router.post("/password-reset/request", requestPasswordReset);
router.post("/password-reset/confirm", confirmPasswordReset);

// Verificación de sesión (JWT)
router.get("/verify", verifyToken, (req, res) =>
  res.status(200).json({ user: req.user })
);

// Test mail
router.post("/test-mail", async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ message: "Missing 'to' field" });
    const fakeToken = "TEST_TOKEN_" + Date.now();
    await sendVerificationEmail(to, fakeToken);
    return res.status(200).json({ message: "Test email sent", to, fakeToken });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Error sending test mail", error: err.message });
  }
});

// 🆕 GOOGLE OAUTH (inicio por rol + callback)
router.get("/google/client", googleStartClient); // ?intent=login|register&next=...
router.get("/google/professional", googleStartProfessional); // ?intent=login|register&next=...
router.get("/google/callback", googleCallback);

/* DEBUG en dev */
if (process.env.NODE_ENV !== "production") {
  router.get("/debug-user", debugGetUserByEmail);
  router.post("/debug-regenerate-token", debugRegenerateToken);
}

export default router;
