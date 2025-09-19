// src/services/mailer.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

function getConfig() {
  const {
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM,
    SMTP_NO_REPLY, SMTP_SUPPORT, SMTP_FROM_NAME, SMTP_SECURE,
    SMTP_REPLY_TO, // por compat
    APP_PUBLIC_URL,
  } = process.env;

  const portNum = Number(SMTP_PORT || 587);
  const secureFlag =
    String(SMTP_SECURE || "").toLowerCase() === "true" || portNum === 465;

  return {
    SMTP_HOST,
    SMTP_PORT: portNum,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE: secureFlag,
    // remitente por defecto: misma casilla SMTP para evitar rechazos del proveedor
    SMTP_FROM: SMTP_FROM || SMTP_NO_REPLY || SMTP_USER || "no-reply@suinfi.com",
    SMTP_NO_REPLY: SMTP_NO_REPLY || SMTP_FROM || SMTP_USER || "no-reply@suinfi.com",
    SMTP_SUPPORT: SMTP_SUPPORT || SMTP_REPLY_TO || "info@suinfi.com",
    SMTP_FROM_NAME: SMTP_FROM_NAME || "SUINFI",
    APP_PUBLIC_URL: APP_PUBLIC_URL || "http://localhost:5173",
  };
}

function buildFrom() {
  const cfg = getConfig();
  const fromEmail = cfg.SMTP_NO_REPLY || cfg.SMTP_FROM;
  const name = cfg.SMTP_FROM_NAME || "SUINFI";
  const from = `"${name}" <${fromEmail}>`;
  const replyTo = cfg.SMTP_SUPPORT ? cfg.SMTP_SUPPORT : undefined;
  return { from, replyTo };
}

let transporterPromise = null;
async function getTransporter() {
  if (transporterPromise) return transporterPromise;
  const cfg = getConfig();

  if (!cfg.SMTP_HOST || !cfg.SMTP_USER || !cfg.SMTP_PASS) {
    console.warn("⚠️ SMTP incompleto: falta host, user o pass → modo DEV.");
    transporterPromise = Promise.resolve(null);
    return transporterPromise;
  }

  transporterPromise = (async () => {
    const t = nodemailer.createTransport({
      host: cfg.SMTP_HOST,
      port: cfg.SMTP_PORT,
      secure: cfg.SMTP_SECURE, // true para 465, false para 587 (STARTTLS)
      auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS },
    });
    try {
      await t.verify();
      console.log(
        `✅ SMTP verificado (${cfg.SMTP_HOST}:${cfg.SMTP_PORT} ${cfg.SMTP_SECURE ? "secure" : "starttls"})`
      );
      return t;
    } catch (e) {
      console.error("❌ SMTP verify failed:", e?.message || e);
      return null; // fuerza modo DEV
    }
  })();

  return transporterPromise;
}

export async function sendVerificationEmail(to, token) {
  const { APP_PUBLIC_URL } = getConfig();
  const { from, replyTo } = buildFrom();

  const link = `${APP_PUBLIC_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = "Confirmá tu correo en SUINFI";

  const text = [
    "Bienvenid@, para activar tu cuenta abrí este enlace:",
    link,
    "",
    "El enlace expira en 48 horas.",
  ].join("\n");

  const html = `
  <div style="margin:0;padding:0;background:#f7f8fb">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fb;padding:24px 0">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;box-shadow:0 6px 24px rgba(16,24,40,.06);border:1px solid #e5e7eb">
          <tr><td style="padding:24px 28px 0 28px;text-align:left">
            <div style="font-weight:800;font-size:22px;letter-spacing:.5px;font-family:system-ui,-apple-system,Segoe UI,Roboto;color:#1f2a44;">SUINFI</div>
          </td></tr>
          <tr><td style="padding:16px 28px 0 28px;text-align:left">
            <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;font-family:system-ui,-apple-system,Segoe UI,Roboto">Bienvenid@, para activar tu cuenta hacé click en el botón:</p>
          </td></tr>
          <tr><td align="center" style="padding:20px 28px 0 28px">
            <a href="${link}" style="display:inline-block;background:linear-gradient(180deg,#1f2a44,#111827);color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:800;font-size:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto;cursor:pointer">
              Verificar mi correo
            </a>
          </td></tr>
          <tr><td style="padding:20px 28px 0 28px">
            <p style="margin:0 0 6px 0;color:#64748b;font-size:12px;line-height:1.6;font-family:system-ui,-apple-system,Segoe UI,Roboto">
              Si el botón no funciona, copiá y pegá este enlace en tu navegador:
            </p>
            <div style="word-break:break-all;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px">
              <a href="${link}" style="color:#0a0e17;text-decoration:none;font-size:12px;font-family:ui-monospace,monospace">${link}</a>
            </div>
            <p style="margin:10px 0 0 0;color:#94a3b8;font-size:12px;font-family:system-ui,-apple-system,Segoe UI,Roboto">
              Este enlace expira en 48 horas.
            </p>
          </td></tr>
        </table>
        <div style="color:#94a3b8;font-size:11px;margin-top:12px;font-family:system-ui,-apple-system,Segoe UI,Roboto">© ${new Date().getFullYear()} SUINFI</div>
      </td></tr>
    </table>
  </div>`;

  const transporter = await getTransporter();
  if (!transporter) {
    console.log("📧 [DEV] Enviar a:", to);
    console.log("📧 [DEV] Link:", link);
    return { dev: true };
  }

  const info = await transporter.sendMail({ from, replyTo, to, subject, text, html });
  console.log("📨 Email enviado:", info?.messageId || "(sin id)");
  return { ok: true, id: info?.messageId };
}

export async function sendPasswordResetEmail(to, name, token) {
  const { APP_PUBLIC_URL } = getConfig();
  const { from, replyTo } = buildFrom();

  const link = `${APP_PUBLIC_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Restablecer contraseña – SUINFI";

  const text = [
    `Hola ${name || ""},`,
    "Recibimos una solicitud para restablecer tu contraseña.",
    "Si fuiste vos, abrí este enlace (válido por 1 hora):",
    link,
    "",
    "Si no solicitaste esto, ignorá este mensaje.",
  ].join("\n");

  const html = `
  <div style="margin:0;padding:0;background:#f7f8fb">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fb;padding:24px 0">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;box-shadow:0 6px 24px rgba(16,24,40,.06);border:1px solid #e5e7eb">
          <tr><td style="padding:24px 28px 0 28px;text-align:left">
            <div style="font-weight:800;font-size:22px;letter-spacing:.5px;font-family:system-ui,-apple-system,Segoe UI,Roboto;color:#1f2a44;">SUINFI</div>
          </td></tr>
          <tr><td style="padding:16px 28px 0 28px;text-align:left">
            <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;font-family:system-ui,-apple-system,Segoe UI,Roboto">
              Hola ${name || ""}, hacé click para restablecer tu contraseña (válido 1 hora):
            </p>
          </td></tr>
          <tr><td align="center" style="padding:20px 28px 0 28px">
            <a href="${link}" style="display:inline-block;background:linear-gradient(180deg,#1f2a44,#111827);color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:800;font-size:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto;cursor:pointer">
              Restablecer contraseña
            </a>
          </td></tr>
          <tr><td style="padding:20px 28px 0 28px">
            <p style="margin:0 0 6px 0;color:#64748b;font-size:12px;line-height:1.6;font-family:system-ui,-apple-system,Segoe UI,Roboto">
              Si el botón no funciona, copiá y pegá este enlace:
            </p>
            <div style="word-break:break-all;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px">
              <a href="${link}" style="color:#0a0e17;text-decoration:none;font-size:12px;font-family:ui-monospace,monospace">${link}</a>
            </div>
          </td></tr>
        </table>
        <div style="color:#94a3b8;font-size:11px;margin-top:12px;font-family:system-ui,-apple-system,Segoe UI,Roboto">© ${new Date().getFullYear()} SUINFI</div>
      </td></tr>
    </table>
  </div>`;

  const transporter = await getTransporter();
  if (!transporter) {
    console.log("📧 [DEV] Enviar a:", to);
    console.log("📧 [DEV] Link:", link);
    return { dev: true };
  }
  const info = await transporter.sendMail({ from, replyTo, to, subject, text, html });
  console.log("📨 Reset mail enviado:", info?.messageId || "(sin id)");
  return { ok: true, id: info?.messageId };
}

export async function sendNotificationEmail({ to, subject, html, text }) {
  const transporter = await getTransporter();
  const { from, replyTo } = buildFrom();

  if (!transporter) {
    console.log("📧 [DEV][notif] →", to, subject);
    return { dev: true };
  }
  const info = await transporter.sendMail({
    from,
    replyTo,
    to,
    subject,
    text: text || "",
    html: html || `<p>${text || subject || "Notificación"}</p>`,
  });
  console.log("📨 Notif mail enviado:", info?.messageId || "(sin id)");
  return { ok: true, id: info?.messageId };
}

export async function debugVerifySmtp() {
  const t = await getTransporter();
  if (t) {
    console.log("✅ SMTP listo (verificación OK).");
  } else {
    console.log("⚠️ SMTP deshabilitado o credenciales inválidas. Se usarán logs [DEV].");
  }
}
