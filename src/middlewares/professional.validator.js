// src/middlewares/professional.validator.js
import { body } from "express-validator";

export const patchMyProfessionalRules = [
  body("address").optional().isObject().withMessage("address debe ser un objeto"),
  body("address.country").optional().isString().trim().notEmpty().withMessage("country requerido"),
  body("address.province").optional().isString().trim().notEmpty().withMessage("province requerido"),
  body("address.street").optional().isString().trim().notEmpty().withMessage("street requerido"),
  body("address.number").optional().isString().trim().notEmpty().withMessage("number requerido"),
  body("address.postalCode").optional().isString().trim().notEmpty().withMessage("postalCode requerido"),
];