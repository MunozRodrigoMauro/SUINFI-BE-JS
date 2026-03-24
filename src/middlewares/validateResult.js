// src/middlewares/validateResult.js
import { validationResult } from "express-validator";

// 📌 Middleware que chequea si hubo errores de validación
export const validateResult = (req, res, next) => {
  const errors = validationResult(req); // Captura errores validados previamente

  if (!errors.isEmpty()) {
    const normalizedErrors = errors.array().map((err) => ({
      type: err.type,
      value: err.value,
      msg: err.msg,
      path: err.path,
      location: err.location,
    }));

    const firstMessage =
      normalizedErrors.length > 0 && typeof normalizedErrors[0].msg === "string"
        ? normalizedErrors[0].msg
        : "Hay datos inválidos.";

    // Si hay errores, devolvemos 400 y el detalle
    return res.status(400).json({
      message: firstMessage,
      errors: normalizedErrors
    });
    // const messages = errors.array().map(err => err.msg);
    // return res.status(400).json({ errors: messages });
  }

  // Si no hay errores, pasamos al siguiente paso (el controlador)
  next(); // Llama a la siguiente función en la cadena (en este caso: createUser)
};

/*
[CAMBIOS HECHOS AQUÍ]
- Se agregó `message` con el primer error para que el frontend muestre un texto claro.
- Se mantuvo `errors` para no romper compatibilidad con otras pantallas.
*/