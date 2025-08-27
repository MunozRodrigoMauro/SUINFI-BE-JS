import UserModel from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendVerificationEmail } from "../services/mailer.js";
import { ensureProfileByRole } from "../services/ensureProfile.js";

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

    // Bloqueo si NO verificado
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
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// 📌 Verificar email con token
export const verifyEmailByToken = async (req, res) => {
  try {
    const { token } = req.params;
    console.log("🔎 [verifyEmailByToken] token recibido:", token ? token.slice(0,12) + "…" : "(vacío)");

    if (!token) {
      return res.status(400).json({ message: "Missing token" });
    }

    // Busco user con token vigente
    const user = await UserModel.findOne({
      "emailVerification.token": token,
      "emailVerification.expiresAt": { $gt: new Date() },
    });

    if (!user) {
      console.log("🔎 [verifyEmailByToken] no se encontró usuario para ese token");
      return res.status(400).json({ message: "Token expirado o inválido" });
    }

    // Marcar verificado y limpiar token
    user.verified = true;
    user.emailVerification = { token: "", expiresAt: null };

    // guardo sin tocar timestamps (opcional)
    await user.save();

    // Auto-crear el stub al verificar email (consistencia)
    if (user.role === "professional") {
      await ProfessionalModel.updateOne(
        { user: user._id },
        { $setOnInsert: { user: user._id, status: "draft" } },
        { upsert: true }
      );
    }


    console.log("✅ [verifyEmailByToken] email verificado para:", user.email);
    return res.status(200).json({ message: "Correo electrónico verificado exitosamente" });
  } catch (e) {
    console.error("❌ [verifyEmailByToken] error:", e);
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
    if (user.verified)
      return res.status(200).json({ message: "Usuario ya verificado" });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 48); // 48h
    user.emailVerification = { token, expiresAt: expires };
    await user.save();

    try {
      await sendVerificationEmail(user.email, token);
    } catch (e) {
      console.error("❌ Error enviando correo de verificación:", e);
    }

    return res.status(200).json({ message: "Correo de verificación reenviado exitosamente" });
  } catch (e) {
    return res.status(500).json({ message: "Error al reenviar correo de verificación" });
  }
};

export const debugGetUserByEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Missing email" });

    const user = await UserModel.findOne({ email }).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    // devolvemos solo lo necesario
    return res.json({
      id: user._id,
      email: user.email,
      verified: user.verified,
      emailVerification: user.emailVerification, // { token, expiresAt }
    });
  } catch (e) {
    console.error("[debugGetUserByEmail] error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

// Regenera token de verificación para ese email (y opcionalmente reenvía)
export const debugRegenerateToken = async (req, res) => {
  try {
    const { email, send = "false" } = req.body || {};
    if (!email) return res.status(400).json({ message: "Missing email" });

    const user = await UserModel.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 48);
    user.emailVerification = { token, expiresAt: expires };
    await user.save();

    if (String(send).toLowerCase() === "true") {
      // envío “best-effort”
      try {
        const { sendVerificationEmail } = await import("../services/mailer.js");
        await sendVerificationEmail(user.email, token);
      } catch (e) {
        console.warn("debugRegenerateToken: email send error:", e?.message || e);
      }
    }

    return res.json({
      message: "Token regenerated",
      email: user.email,
      token,
      expiresAt: expires,
    });
  } catch (e) {
    console.error("[debugRegenerateToken] error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};