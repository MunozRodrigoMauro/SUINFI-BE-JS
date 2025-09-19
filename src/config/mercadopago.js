// src/config/mercadopago.js
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

function sanitizeToken(raw) {
  return String(raw || "")
    .replace(/^"(.*)"$/, "$1")
    .replace(/^'(.*)'$/, "$1")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function buildClient(rawToken) {
  const accessToken = sanitizeToken(rawToken);
  if (!accessToken) throw new Error("Mercado Pago no configurado (MP_ACCESS_TOKEN vacío).");

  if (!global.__MP_TOKEN_LOGGED__) {
    global.__MP_TOKEN_LOGGED__ = true;
    const prefix = accessToken.slice(0, 5);
    const suffix = accessToken.slice(-6);
    console.log(`[MP] token prefix=${prefix}, suffix=${suffix}, length=${accessToken.length}`);
    if (!/^TEST-/.test(accessToken) && !/^APP_USR-/.test(accessToken)) {
      console.warn("[MP] ⚠️ Prefijo inesperado en MP_ACCESS_TOKEN. Esperaba TEST- (sandbox) o APP_USR- (prod).");
    }
  }

  const cfg = new MercadoPagoConfig({ accessToken });
  return { pref: new Preference(cfg), payment: new Payment(cfg) };
}

export function platformMP() {
  return buildClient(process.env.MP_ACCESS_TOKEN);
}
export function sellerMP(accessToken) {
  return buildClient(accessToken);
}
