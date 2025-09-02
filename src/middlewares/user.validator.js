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
    .isLength({ min: 8 })
    .withMessage("La contraseña debe tener al menos 8 caracteres.")
    .matches(/[a-z]/)
    .withMessage("La contraseña debe contener al menos una letra minúscula.")
    .matches(/[A-Z]/)
    .withMessage("La contraseña debe contener al menos una letra mayúscula.")
    .matches(/\d/)
    .withMessage("La contraseña debe contener al menos un número.")
    .matches(/[!@#$%^&*]/)
    .withMessage("La contraseña debe contener al menos un carácter especial (!@#$%^&*)"),

  // 🟩 Buena práctica: validamos que el role sea uno válido
  body("role")
    .optional()
    .isIn(["user", "professional", "admin", "client"])
    .withMessage("Invalid role")
];

