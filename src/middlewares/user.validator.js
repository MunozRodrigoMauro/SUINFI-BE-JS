// Importamos funciones para validar campos del request
import { body } from "express-validator";
import { capitalizeWords } from "../utils/capitalizeWords.js";

// Creamos un array de validaciones para el registro de usuario
export const userValidationRules = [
  // 📌 Validamos que el nombre no esté vacío
  body("name")
    .trim()
    .notEmpty().withMessage("Name is required")
    .isLength({ min: 2, max: 50 }).withMessage("Name length 2–50")
    .matches(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/u).withMessage("Invalid name characters")
    .customSanitizer(v => capitalizeWords(v)),

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
    .matches(/[^A-Za-z0-9]/)
    .withMessage("La contraseña debe contener al menos un símbolo."),

  // 🟩 Buena práctica: validamos que el role sea uno válido
  body("role")
    .optional()
    .isIn(["user", "professional", "admin", "client"])
    .withMessage("Invalid role")
];

/*
[CAMBIOS HECHOS AQUÍ]
- Se alineó la validación del símbolo con mobile y reset password:
  ahora acepta cualquier carácter no alfanumérico y no solo !@#$%^&*.
- No se tocó ninguna otra validación.
*/