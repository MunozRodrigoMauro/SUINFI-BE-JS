// src/controllers/auth.controller.js
// (Se mantiene tu lógica local. No agrega rutas Google aquí.)
// 🛠 CAMBIO: SIN cambios funcionales salvo mantener exactamente tu código.

import UserModel from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendVerificationEmail, sendPasswordResetEmail } from "../services/mailer.js";
import { ensureProfileByRole } from "../services/ensureProfile.js";
import ProfessionalModel from "../models/Professional.js";

const hashToken = (t) => crypto.createHash("sha256").update(t).digest("hex");

// 📌 Login
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await UserModel.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    if (!user.verified) {
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        message: "Por favor, veririca tu email para continuar.",
      });
    }

    await ensureProfileByRole(user);

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(200).json({
      message: "Login exitoso",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// 📌 Verificar email con token
export const verifyEmailByToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ message: "Missing token" });

    const user = await UserModel.findOne({
      "emailVerification.token": token,
      "emailVerification.expiresAt": { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ message: "Token expirado o inválido" });

    user.verified = true;
    user.emailVerification = { token: "", expiresAt: null };
    await user.save();

    if (user.role === "professional") {
      await ProfessionalModel.updateOne(
        { user: user._id },
        { $setOnInsert: { user: user._id, status: "draft" } },
        { upsert: true }
      );
    }

    return res.status(200).json({ message: "Correo electrónico verificado exitosamente" });
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
};

// 📌 Reenviar verificación
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await UserModel.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.verified) return res.status(200).json({ message: "Usuario ya verificado" });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 48);
    user.emailVerification = { token, expiresAt: expires };
    await user.save();

    try {
      await sendVerificationEmail(user.email, token);
    } catch {}

    return res.status(200).json({ message: "Correo de verificación reenviado exitosamente" });
  } catch (e) {
    return res.status(500).json({ message: "Error al reenviar correo de verificación" });
  }
};

/* ==================== 🔐 Reset de contraseña (público) ==================== */
// POST /api/auth/password-reset/request { email }
export async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body || {};
    const normalized = (email || "").toLowerCase().trim();

    if (!normalized) {
      return res.status(400).json({ message: "Email requerido" });
    }

    const user = await UserModel.findOne({ email: normalized });

    // 🧩 Por seguridad: seguimos sin decir si existe o no
    if (!user) {
      return res.json({
        message: "Si el email existe, te enviamos instrucciones.",
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetTokenHash = hashToken(rawToken);
    user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await user.save();

    try {
      const result = await sendPasswordResetEmail(
        user.email,
        user.name || user.email,
        rawToken
      );
      console.log("reset mail result:", result);
    } catch (e) {
      console.error("❌ reset mail error:", e?.message || e);
      // 👇 AHORA SÍ devolvemos error si el mail falla
      return res
        .status(500)
        .json({ message: "No pudimos enviar el correo. Probá más tarde." });
    }

    return res.json({
      message: "Si el email existe, te enviamos instrucciones.",
    });
  } catch (e) {
    console.error("❌ requestPasswordReset error:", e);
    return res.status(500).json({ message: "Server error" });
  }
}


// POST /api/auth/password-reset/confirm { token, newPassword }
export async function confirmPasswordReset(req, res) {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) return res.status(400).json({ message: "Datos inválidos" });

  // Validación básica/consistente con registro
  const strong =
    typeof newPassword === "string" &&
    newPassword.length >= 8 &&
    /[a-z]/.test(newPassword) &&
    /[A-Z]/.test(newPassword) &&
    /\d/.test(newPassword) &&
    /[!@#$%^&*]/.test(newPassword);

  if (!strong) {
    return res.status(400).json({
      message: "La nueva contraseña no cumple los requisitos.",
    });
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  const user = await UserModel.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: now },
  });

  if (!user) return res.status(400).json({ message: "Token inválido o vencido" });

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  await user.save();

  return res.json({ message: "Contraseña actualizada" });
}

/* ==================== DEBUG helpers (dev) ==================== */
export const debugGetUserByEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Missing email" });
    const user = await UserModel.findOne({ email }).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({
      id: user._id,
      email: user.email,
      verified: user.verified,
      emailVerification: user.emailVerification,
      hasReset: Boolean(user.passwordResetTokenHash),
      resetExp: user.passwordResetExpiresAt,
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const debugRegenerateToken = async (req, res) => {
  try {
    const { email, send = "false" } = req.body || {};
    if (!email) return res.status(400).json({ message: "Missing email" });
    const user = await UserModel.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = crypto.randomBytes(32).toString("hex").toLowerCase();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 48);
    user.emailVerification = { token, expiresAt: expires };
    await user.save();

    if (String(send).toLowerCase() === "true") {
      try {
        await sendVerificationEmail(user.email, token);
      } catch {}
    }

    return res.json({
      message: "Token regenerated",
      email: user.email,
      token,
      expiresAt: expires,
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
};
