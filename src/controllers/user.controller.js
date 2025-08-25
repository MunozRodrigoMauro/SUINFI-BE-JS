import UserModel from "../models/User.js";
import bcrypt from "bcrypt";
import ProfessionalModel from "../models/Professional.js";
import crypto from "crypto";
import { sendVerificationEmail } from "../services/mailer.js";

// Crear usuario
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const userExist = await UserModel.findOne({ email });
    if (userExist) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Token de verificación en minúsculas (consistencia)
    const verifyToken = crypto.randomBytes(32).toString("hex").toLowerCase();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 48); // 48h

    const user = new UserModel({
      name,
      email,
      password: hashedPassword,
      role,
      verified: false,
      emailVerification: { token: verifyToken, expiresAt: expires },
    });

    const savedUser = await user.save();

    try {
      await sendVerificationEmail(savedUser.email, verifyToken);
    } catch (e) {
      console.error("❌ Error enviando correo de verificación:", e);
    }

    return res.status(201).json({
      message: "User created. Please verify your email.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

// Obtener todos
export const getUsers = async (_req, res) => {
  try {
    const users = await UserModel.find();
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

// Mi perfil (usuario logueado)
export const getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await UserModel.findById(userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json(user);
  } catch (error) {
    console.error("❌ Error al obtener perfil:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

// Actualizar mi perfil
export const updateMe = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    const allowed = [
      "name", "password",
      "address.country", "address.state", "address.city", "address.street", "address.number",
      "address.unit", "address.postalCode",
      "address.label",
      "address.location.lat", "address.location.lng",
    ];

    const payload = {};
    for (const path of allowed) {
      const [root, k1, k2] = path.split(".");
      if (k2) {
        if (!payload[root]) payload[root] = {};
        if (!payload[root][k1]) payload[root][k1] = {};
        if (req.body?.[root]?.[k1]?.[k2] != null) {
          payload[root][k1][k2] = req.body[root][k1][k2];
        }
      } else if (k1) {
        if (!payload[root]) payload[root] = {};
        if (req.body?.[root]?.[k1] != null) payload[root][k1] = req.body[root][k1];
      } else if (req.body?.[root] != null) {
        payload[root] = req.body[root];
      }
    }

    if (payload.password) {
      if (String(payload.password).length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const bcryptMod = (await import("bcrypt")).default;
      payload.password = await bcryptMod.hash(String(payload.password), 10);
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    const { password: _pw, ...userSafe } = updatedUser.toObject();
    return res.status(200).json({ user: userSafe });
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Perfil profesional (requiere ProfessionalModel)
export const getMyProfile = async (req, res) => {
  try {
    const u = req.user;
    const prof = await ProfessionalModel.findOne({ user: u.id }, "location").lean();

    const hasName = (u.name || "").trim().length >= 2;
    const hasAvatar = (u.avatarUrl || "").trim().length > 0;
    const hasLocation = !!(prof?.location?.coordinates?.length === 2);

    const requiresOnboarding = !(hasName && hasLocation);

    res.json({ user: u, requiresOnboarding });
  } catch (e) {
    console.error("❌ getMyProfile:", e);
    res.status(500).json({ error: "Server error" });
  }
};