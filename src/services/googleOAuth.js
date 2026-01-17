// src/services/googleOAuth.js
// 🛠 CAMBIO: soporte de intent/role/next en state firmado y fix del REDIRECT_URI

import crypto from "crypto";

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  PORT,
  OAUTH_STATE_SECRET, // 🛠 CAMBIO: secreto para firmar `state` (fallback al JWT_SECRET)
  JWT_SECRET,
} = process.env;

// 🛠 CAMBIO: Fallback local correctamente formateado
const REDIRECT_URI =
  GOOGLE_REDIRECT_URI ||
  `http://localhost:${PORT || 3000}/api/auth/google/callback`;

// Helpers base64url
const toBase64Url = (buf) =>
  Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const fromBase64Url = (str) =>
  Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");

// 🛠 CAMBIO: firmar/verificar `state` para evitar manipulación
function signState(payloadObj) {
  const secret = OAUTH_STATE_SECRET || JWT_SECRET || "dev_fallback_state_secret";
  const json = JSON.stringify(payloadObj);
  const b64 = toBase64Url(Buffer.from(json, "utf8"));
  const h = crypto.createHmac("sha256", secret).update(b64).digest();
  const sig = toBase64Url(h);
  return `${b64}.${sig}`;
}

// 🛠 CAMBIO: compatibilidad hacia atrás (si te llaman con string)
function normalizeArgs(arg) {
  if (typeof arg === "string") {
    return { next: arg, intent: "login", role: "user" };
  }
  if (!arg || typeof arg !== "object") {
    return { next: "", intent: "login", role: "user" };
  }

  const next = typeof arg.next === "string" ? arg.next : "";
  const intent = typeof arg.intent === "string" ? arg.intent : "login";
  const role = typeof arg.role === "string" ? arg.role : "user";

  return { next, intent, role };
}

export function verifyAndDecodeState(state) {
  try {
    const secret = OAUTH_STATE_SECRET || JWT_SECRET || "dev_fallback_state_secret";
    if (!state || !String(state).includes(".")) return null;

    const parts = String(state).split(".");
    if (parts.length !== 2) return null;

    const b64 = parts[0];
    const sig = parts[1];

    const expected = toBase64Url(
      crypto.createHmac("sha256", secret).update(b64).digest()
    );
    if (sig !== expected) return null;

    const json = fromBase64Url(b64).toString("utf8");
    const obj = JSON.parse(json);

    // Validaciones mínimas
    if (!obj || typeof obj !== "object") return null;
    if (!obj.intent || !obj.role) return null;
    if (!["login", "register"].includes(obj.intent)) return null;
    if (!["user", "professional"].includes(obj.role)) return null;

    return obj;
  } catch {
    return null;
  }
}

// 🛠 CAMBIO: URL builder acepta intent/role/next y firma state
export function getGoogleAuthURL(arg) {
  const { next = "", intent, role } = normalizeArgs(arg);

  const root = "https://accounts.google.com/o/oauth2/v2/auth";
  const nonce = crypto.randomBytes(16).toString("hex"); // anti-replay básico
  const state = signState({ next, intent, role, nonce });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "openid email profile",
    state,
  });

  return `${root}?${params.toString()}`;
}

export async function getTokens({ code }) {
  const url = "https://oauth2.googleapis.com/token";
  const body = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "token_exchange_failed");
  }
  return data; // { id_token, access_token, ... }
}

export async function getGoogleUser(id_token, access_token) {
  const qs = new URLSearchParams({ access_token }).toString();
  const url = `https://www.googleapis.com/oauth2/v3/userinfo?${qs}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${id_token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error("userinfo_failed");
  return data; // { sub, email, name, picture, email_verified, ... }
}
