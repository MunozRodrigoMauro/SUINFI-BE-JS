// src/middlewares/professional.validator.js
import { body } from "express-validator";

/**
 * 🚫 NO TOCAR: tus reglas originales
 */
export const patchMyProfessionalRules = [
  body("address").optional().isObject().withMessage("address debe ser un objeto"),
  body("address.country").optional().isString().trim().notEmpty().withMessage("country requerido"),
  body("address.province").optional().isString().trim().notEmpty().withMessage("province requerido"),
  body("address.street").optional().isString().trim().notEmpty().withMessage("street requerido"),
  body("address.number").optional().isString().trim().notEmpty().withMessage("number requerido"),
  body("address.postalCode").optional().isString().trim().notEmpty().withMessage("postalCode requerido"),
];

/**
 * ✅ Compatibilidad adicional para aceptar address.state sin romper lo existente.
 * Úsalo junto con tus reglas cuando el FE envíe 'state'.
 */
export const addressStateCompatRules = [
  body("address.state")
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage("state requerido"),
];

/**
 * ✅ Reglas opcionales para whatsapp (number + visible)
 * No pisa nada existente; se puede componer en la ruta.
 */
export const whatsappProfessionalRules = [
  body("whatsapp").optional().isObject().withMessage("whatsapp debe ser un objeto"),
  body("whatsapp.visible").optional().isBoolean().withMessage("whatsapp.visible debe ser boolean"),
  body("whatsapp.number").optional().isString().trim().withMessage("whatsapp.number debe ser string"),
];

/**
 * ✅ Nacionalidad como ISO-3166-1 alpha-2 (AR, MX, ES, etc.)
 */
export const nationalityRule = [
  body("nationality")
    .optional()
    .isISO31661Alpha2()
    .withMessage("nationality debe ser código ISO-3166-1 alpha-2"),
];

/**
 * ✅ Campos de address opcionales adicionales (no obligan nada)
 */
export const addressOptionalRules = [
  body("address.city").optional().isString().trim(),
  body("address.unit").optional().isString().trim(),
  body("address.label").optional().isString().trim(),
  body("address.location.lat").optional().isFloat().toFloat(),
  body("address.location.lng").optional().isFloat().toFloat(),
];

/**
 * ✅ Otros campos de perfil profesional que podés validar de forma opcional
 */
export const professionalUpdateOptionalRules = [
  body("bio").optional().isString(),
  body("services").optional().isArray(),
  body("phone").optional().isString(),
  body("showPhone").optional().isBoolean(),
];
