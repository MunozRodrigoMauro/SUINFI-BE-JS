// src/middlewares/role.middleware.js

/**
 * Middleware para permitir solo usuarios con rol "admin"
 */
export const isAdmin = (req, res, next) => {
    // req.user viene del middleware verifyToken
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Access denied - Admin only" });
    }
  
    next(); // Continúa si es admin
};
  
/**
 * Verifica si el usuario tiene rol "professional"
 */     
export const isProfessional = (req, res, next) => {
    if (req.user?.role !== "professional") {
      return res.status(403).json({ message: "Access denied - Professionals only" });
    }
    next();
};
  
/**
 * Verifica si el usuario es él mismo o admin
 */
export const isSelfOrAdmin = (req, res, next) => {
    const userIdFromToken = req.user?.id;
    const userIdFromParams = req.params.id;

    if (userIdFromToken !== userIdFromParams && req.user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied - Not allowed" });
    }

    next();
};