// src/services/push.service.js
import User from "../models/User.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Validación simple para tokens Expo */
function isValidExpoToken(token) {
  const t = String(token || "").trim();
  if (!t) return false;
  return (
    t.startsWith("ExponentPushToken[") ||
    t.startsWith("ExpoPushToken[")
  );
}

/** fetch compatible (Node 18+ tiene fetch global) */
async function fetchJson(url, opts) {
  const f =
    typeof fetch === "function"
      ? fetch
      : (await import("node-fetch")).default;

  const res = await f(url, opts);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

/** Enviar push a una lista de tokens */
export async function sendExpoPush({ tokens, title, body, data = {} }) {
  const clean = (tokens || []).map(String).map(s => s.trim()).filter(isValidExpoToken);
  if (!clean.length) return { ok: true, skipped: true, reason: "no_tokens" };

  const accessToken = process.env.EXPO_ACCESS_TOKEN || "";
  const headers = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  // Expo recomienda mandar en batches chicos; 100 es safe
  const batchSize = 100;
  const chunks = [];
  for (let i = 0; i < clean.length; i += batchSize) chunks.push(clean.slice(i, i + batchSize));

  const results = [];
  for (const chunk of chunks) {
    const messages = chunk.map((to) => ({
      to,
      title: String(title || "CuyIT"),
      body: String(body || ""),
      data: data && typeof data === "object" ? data : {},
      sound: "default",
      priority: "high",
    }));

    const { ok, status, json } = await fetchJson(EXPO_PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(messages),
    });

    results.push({ ok, status, json });
  }

  return { ok: true, results };
}

/** Enviar push a un usuario (lee tokens desde DB) */
export async function sendPushToUser(userId, { title, body, data }) {
  try {
    if (!userId) return { ok: true, skipped: true, reason: "no_userId" };
    const u = await User.findById(userId, "expoPushTokens").lean();
    const tokens = u?.expoPushTokens || [];
    return await sendExpoPush({ tokens, title, body, data });
  } catch (e) {
    console.warn("sendPushToUser error:", e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  }
}
