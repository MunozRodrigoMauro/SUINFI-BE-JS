import jwt from "jsonwebtoken";
import UserModel from "../models/User.js";

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
      return res.status(401).json({ message: "No token provided" });
    }
    const raw = authHeader.replace(/^Bearer\s+/i, "").trim();
    const match = raw.match(/[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/);
    const token = match ? match[0] : raw;

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      console.error("❌ JWT verify error:", e?.message || e);
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = await UserModel.findById(decoded.id).select("-password");
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    req.user = user;
    // 🔔 Marca actividad si es profesional
    try {
      if (String(user.role) === "professional") {
        const Professional = (await import("../models/Professional.js")).default;
        await Professional.updateOne(
          { user: user._id },
            { $set: { lastActivityAt: new Date() } },
            { timestamps: false }
          );
      }
    } catch (e) {
      // no rompe auth si falla
      console.warn("touch lastActivityAt failed:", e?.message || e);
    }
    next();
  } catch (error) {
    console.error("❌ Error en verificación de token:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const requireAdmin = (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase();
  if (role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
};
