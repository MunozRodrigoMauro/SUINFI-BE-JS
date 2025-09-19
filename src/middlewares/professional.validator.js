import { body } from "express-validator";

/** (lo que ya tenías)… */

export const patchMyProfessionalRules = [
  body("address").optional().isObject().withMessage("address debe ser un objeto"),
  body("address.country").optional().isString().trim().notEmpty().withMessage("country requerido"),
  body("address.province").optional().isString().trim().notEmpty().withMessage("province requerido"),
  body("address.street").optional().isString().trim().notEmpty().withMessage("street requerido"),
  body("address.number").optional().isString().trim().notEmpty().withMessage("number requerido"),
  body("address.postalCode").optional().isString().trim().notEmpty().withMessage("postalCode requerido"),
];

export const addressStateCompatRules = [
  body("address.state").optional().isString().trim().notEmpty().withMessage("state requerido"),
];

export const whatsappProfessionalRules = [
  body("whatsapp").optional().isObject().withMessage("whatsapp debe ser un objeto"),
  body("whatsapp.visible").optional().isBoolean().withMessage("whatsapp.visible debe ser boolean"),
  body("whatsapp.number").optional().isString().trim().withMessage("whatsapp.number debe ser string"),
];

export const nationalityRule = [
  body("nationality").optional().isISO31661Alpha2().withMessage("nationality debe ser código ISO-3166-1 alpha-2"),
];

export const addressOptionalRules = [
  body("address.city").optional().isString().trim(),
  body("address.unit").optional().isString().trim(),
  body("address.label").optional().isString().trim(),
  body("address.location.lat").optional().isFloat().toFloat(),
  body("address.location.lng").optional().isFloat().toFloat(),
];

export const professionalUpdateOptionalRules = [
  body("bio").optional().isString(),
  body("services").optional().isArray(),
  body("phone").optional().isString(),
  body("showPhone").optional().isBoolean(),
];

export const depositRules = [
  body("depositEnabled").optional().isBoolean().withMessage("depositEnabled debe ser boolean"),
  body("depositAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("depositAmount debe ser un número mayor o igual a 0")
    .toFloat(),
];

// NUEVO: reglas para payout (datos bancarios)
export const payoutRules = [
  body("payout").isObject().withMessage("payout debe ser un objeto"),
  body("payout.holderName").optional().isString().trim().isLength({ min: 3 }),
  body("payout.docType").optional().isIn(["DNI", "CUIT", "CUIL", "PAS", "OTRO"]),
  body("payout.docNumber").optional().isString().trim().isLength({ min: 6 }),
  body("payout.bankName").optional().isString().trim(),
  body("payout.cbu").optional().matches(/^[0-9]{0}|[0-9]{22}$/).withMessage("CBU inválido"),
  body("payout.alias")
    .optional()
    .isString()
    .trim()
    .toLowerCase()
    .matches(/^[a-z0-9_.-]{6,}$/)
    .withMessage("Alias inválido"),
];

// Pack “all”
export const patchMyProfessionalAllRules = [
  ...patchMyProfessionalRules,
  ...addressStateCompatRules,
  ...whatsappProfessionalRules,
  ...nationalityRule,
  ...addressOptionalRules,
  ...professionalUpdateOptionalRules,
  ...depositRules,
];
