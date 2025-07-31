// Importamos funciones para validar campos del request
import { body } from "express-validator";

// Creamos un array de validaciones para el registro de usuario
export const userValidationRules = [
  // 📌 Validamos que el nombre no esté vacío
  body("name")
    .notEmpty()
    .withMessage("Name is required"),

  // 📌 Validamos que el email sea válido
  body("email")
    .isEmail()
    .withMessage("Must be a valid email"),

  // 📌 Validamos que la contraseña tenga mínimo 6 caracteres
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),

  // 🟩 Buena práctica: validamos que el role sea uno válido
  body("role")
    .optional()
    .isIn(["user", "professional", "admin"])
    .withMessage("Invalid role")
];
