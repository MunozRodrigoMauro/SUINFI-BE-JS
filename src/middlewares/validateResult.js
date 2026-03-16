// src/middlewares/validateResult.js
import { validationResult } from "express-validator";

// 📌 Middleware que chequea si hubo errores de validación
export const validateResult = (req, res, next) => {
  const errors = validationResult(req); // Captura errores validados previamente

  if (!errors.isEmpty()) {
    // Si hay errores, devolvemos 400 y el detalle
    return res.status(400).json({
      errors: errors.array()
    });
    // const messages = errors.array().map(err => err.msg);
    // return res.status(400).json({ errors: messages });
  }

  // Si no hay errores, pasamos al siguiente paso (el controlador)
  next(); // Llama a la siguiente función en la cadena (en este caso: createUser)
};
