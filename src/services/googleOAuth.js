// src/services/googleOAuth.js
const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    PORT,
  } = process.env;
  
  // Fallback local para dev
  const REDIRECT_URI =
    GOOGLE_REDIRECT_URI || `http://localhost:${PORT || 3000}/api/auth/google/callback`;
  
  export function getGoogleAuthURL(next) {
    const root = "https://accounts.google.com/o/oauth2/v2/auth";
    const state =
      next ? Buffer.from(JSON.stringify({ next })).toString("base64url") : "";
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
    const url = `https://www.googleapis.com/oauth2/v3/userinfo?${new URLSearchParams(
      { access_token }
    ).toString()}`;
  
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${id_token}` },
    });
  
    const data = await res.json();
    if (!res.ok) throw new Error("userinfo_failed");
    return data; // { sub, email, name, picture, email_verified, ... }
  }
  