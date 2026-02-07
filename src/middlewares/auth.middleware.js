// src/middlewares/auth.middleware.js
import jwt from "jsonwebtoken";
import UserModel from "../models/User.js";

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !/^Bearer\s+/i.test(String(authHeader))) {
      return res.status(401).json({ message: "No token provided" });
    }
    const raw = String(authHeader).replace(/^Bearer\s+/i, "").trim();
    const match = raw.match(/[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/);
    const token = match ? match[0] : raw;

    const secret = process.env.JWT_SECRET || process.env.JWT_KEY || "changeme";

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const decodedId =
      decoded && typeof decoded === "object" ? decoded.id || decoded._id : null;

    if (!decodedId) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = await UserModel.findById(decodedId).select("-password");
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
    } catch {
      // no rompe auth si falla
    }
    next();
  } catch {
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

/*
[CAMBIOS HECHOS AQUÍ]
- Se sacaron console.* (no-console).
- Se unificó el secret JWT (JWT_SECRET || JWT_KEY || "changeme") y se soporta decoded.id / decoded._id.
*/
