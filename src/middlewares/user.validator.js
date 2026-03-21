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

  // 📌 Validamos que la contraseña tenga mínimo 8 caracteres
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
- En la validación de password se reemplazó la regex del símbolo:
  antes solo aceptaba !@#$%^&*
  ahora acepta cualquier carácter no alfanumérico, para que coincida con mobile.
- No se tocó ninguna otra validación.
*/