import jwt from "jsonwebtoken";
import UserModel from "../models/User.js"

// Middleware para verificar el token JWT
export const verifyToken = async (req, res, next) => {
  try {
    // 🔍 Leemos el token del header "Authorization"
    const authHeader = req.headers.authorization;

    // ⚠️ Si no hay token, denegamos acceso
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    // 🧪 Extraemos solo el token (sin el "Bearer ")
    const token = authHeader.split(" ")[1];

    // 🔐 Verificamos el token con la clave secreta
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 🟩 Obtenemos el usuario
    const user = await UserModel.findById(decoded.id).select("-password")
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" })
    
    req.user = user
    next()
    
  } catch (error) {
    console.error("❌ Error en verificación de token:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
