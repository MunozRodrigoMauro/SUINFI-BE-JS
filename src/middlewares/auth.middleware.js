import jwt from "jsonwebtoken";

// Middleware para verificar el token JWT
export const verifyToken = (req, res, next) => {
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

    // ✅ Agregamos los datos del usuario al objeto `req`
    req.user = decoded;

    // 🟢 Pasamos al siguiente middleware o ruta protegida
    next();
  } catch (error) {
    console.error("❌ Error en verificación de token:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
