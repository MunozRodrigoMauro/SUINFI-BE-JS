// src/controllers/oauth.controller.js
// 🛠 CAMBIO: FE_BASE ahora se toma de APP_PUBLIC_URL (o WEB_APP_URL/FRONTEND_URL) con fallback seguro a https://www.cuyit.com
//            Además, en el redirect de éxito incluimos role para mayor claridad.
//            Resto de la lógica intacta.

import jwt from "jsonwebtoken";
import UserModel from "../models/User.js";
import { ensureProfileByRole } from "../services/ensureProfile.js"; // mantenemos tu import existente
import {
  getGoogleAuthURL,
  getTokens,
  getGoogleUser,
  verifyAndDecodeState,
} from "../services/googleOAuth.js";

const {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  APP_PUBLIC_URL, // 🛠 CAMBIO: usamos esta var (es la que tenés en .env del backend)
  WEB_APP_URL, // soportamos también por compatibilidad
  FRONTEND_URL, // soportamos también por compatibilidad
} = process.env;

// 🛠 CAMBIO: Base del frontend, sin slash final. Fallback a prod seguro.
const FE_BASE = (APP_PUBLIC_URL || WEB_APP_URL || FRONTEND_URL || "https://www.cuyit.com").replace(
  /\/+$/,
  ""
);

function issueJwtForUser(user) {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

// 🛠 CAMBIO (NUEVO): permitir deep link mobile con host oauth
function isAllowedMobileRedirect(next) {
  try {
    const url = new URL(String(next || "").trim());
    const protocol = (url.protocol || "").toLowerCase();
    const host = (url.host || "").toLowerCase();

    // Permitimos solo nuestro esquema y host esperado para evitar open-redirect
    if (protocol !== "cuyitmobile:") return false;
    if (host !== "oauth") return false;

    return true;
  } catch {
    return false;
  }
}

// 🛠 CAMBIO (MODIF): ahora redirectToFE usa `next` si es deep link permitido, si no cae a FE_BASE web.
function redirectToFE(res, params, nextUrl) {
  try {
    const next = String(nextUrl || "").trim();
    if (next && isAllowedMobileRedirect(next)) {
      const url = new URL(next);
      Object.entries(params || {}).forEach(([k, v]) => {
        if (v != null) url.searchParams.set(k, String(v));
      });
      return res.redirect(url.toString());
    }
  } catch {
    // noop -> fallback web
  }

  const url = new URL("/oauth/google/callback", FE_BASE);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v != null) url.searchParams.set(k, String(v));
  });
  return res.redirect(url.toString());
}

// GET /api/auth/google/client?intent=login|register&next=/ruta
export async function googleStartClient(req, res) {
  try {
    const { intent, next = "" } = req.query || {};
    if (!["login", "register"].includes(String(intent)))
      return res.status(400).json({ message: "Invalid intent" });
    const url = getGoogleAuthURL({ intent, role: "user", next });
    return res.redirect(url);
  } catch {
    return res.status(500).json({ message: "oauth_start_error" });
  }
}

// GET /api/auth/google/professional?intent=login|register&next=/ruta
export async function googleStartProfessional(req, res) {
  try {
    const { intent, next = "" } = req.query || {};
    if (!["login", "register"].includes(String(intent)))
      return res.status(400).json({ message: "Invalid intent" });
    const url = getGoogleAuthURL({ intent, role: "professional", next });
    return res.redirect(url);
  } catch {
    return res.status(500).json({ message: "oauth_start_error" });
  }
}

// GET /api/auth/google/callback
export async function googleCallback(req, res) {
  try {
    const { code, state } = req.query || {};
    const parsed = verifyAndDecodeState(state);
    if (!parsed) {
      return redirectToFE(res, { error: "OAUTH_STATE_INVALID" }, "");
    }

    const { intent, role, next = "" } = parsed;

    // 1) Intercambio de tokens
    let tokens;
    try {
      tokens = await getTokens({ code });
    } catch {
      return redirectToFE(res, { error: "OAUTH_TOKEN_EXCHANGE_FAILED", role }, next);
    }

    // 2) Userinfo
    let gUser;
    try {
      gUser = await getGoogleUser(tokens.id_token, tokens.access_token);
    } catch {
      return redirectToFE(res, { error: "OAUTH_USERINFO_FAILED", role }, next);
    }

    const email = (gUser?.email || "").toLowerCase();
    const googleId = gUser?.sub;
    const emailVerified = Boolean(gUser?.email_verified);
    const displayName = gUser?.name || email;

    if (!email || !googleId) {
      return redirectToFE(res, { error: "OAUTH_USERINFO_FAILED", role }, next);
    }

    const existing = await UserModel.findOne({ email });

    if (intent === "login") {
      // sin auto-provisión
      if (!existing) {
        return redirectToFE(res, { error: "ACCOUNT_NOT_FOUND_FOR_ROLE", role }, next);
      }
      if (existing.role !== role) {
        // 🛠 CAMBIO: mandamos requestedRole + actualRole para que el mobile muestre mensaje claro
        return redirectToFE(
          res,
          {
            error: "ROLE_CONFLICT",
            requestedRole: role,
            actualRole: existing.role,
          },
          next
        );
      }

      // Linkear googleId si faltaba y marcar verificado si Google lo confirma
      let mustSave = false;
      if (!existing.googleId) {
        existing.googleId = googleId;
        existing.authProvider = "google";
        mustSave = true;
      }
      if (!existing.verified && emailVerified) {
        existing.verified = true;
        mustSave = true;
      }
      if (mustSave) await existing.save();

      const token = issueJwtForUser(existing);
      return redirectToFE(res, { token, next, role }, next);
    }

    // intent === "register"
    if (existing) {
      if (existing.role !== role) {
        // 🛠 CAMBIO: mandamos requestedRole + actualRole para que el mobile muestre mensaje claro
        return redirectToFE(
          res,
          {
            error: "ROLE_CONFLICT",
            requestedRole: role,
            actualRole: existing.role,
          },
          next
        );
      } else {
        return redirectToFE(res, { error: "EMAIL_ALREADY_REGISTERED", role: existing.role }, next);
      }
    }

    // Crear un nuevo usuario con rol explícito
    const newUser = new UserModel({
      name: displayName,
      email,
      role,
      verified: emailVerified,
      googleId,
      authProvider: "google",
    });
    await newUser.save();

    // Crear perfil por rol SOLO en registro
    await ensureProfileByRole(newUser);

    const token = issueJwtForUser(newUser);
    return redirectToFE(res, { token, next, role }, next);
  } catch {
    return redirectToFE(res, { error: "OAUTH_UNEXPECTED" }, "");
  }
}
