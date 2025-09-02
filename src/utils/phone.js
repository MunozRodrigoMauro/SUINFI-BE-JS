// src/utils/phone.js
import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Normaliza un número a E.164 usando una región ISO-2 como hint (AR, CL, ES, etc.).
 * @param {string} raw
 * @param {string} region ISO-2 (opcional, mayúsculas)
 * @returns {null|{e164:string,country:string,nationalNumber:string}}
 */
export function normalizePhone(raw, region) {
  if (!raw) return null;
  const cleaned = String(raw).trim();
  try {
    const phone = parsePhoneNumberFromString(
      cleaned,
      (region || "").toUpperCase() || undefined
    );
    if (!phone || !phone.isValid()) return null;
    return {
      e164: phone.number, // +541112345678
      country: (phone.country || (region || "")).toUpperCase(),
      nationalNumber: phone.nationalNumber || "",
    };
  } catch {
    return null;
  }
}
