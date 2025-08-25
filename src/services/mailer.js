// src/services/mailer.no-logo.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

function getConfig() {
  const {
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, APP_PUBLIC_URL,
  } = process.env;

  return {
    SMTP_HOST,
    SMTP_PORT: Number(SMTP_PORT || 587),
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM: SMTP_FROM || SMTP_USER || "no-reply@suinfi.com",
    APP_PUBLIC_URL: APP_PUBLIC_URL || "http://localhost:5173",
  };
}

let transporterPromise = null;
async function getTransporter() {
  if (transporterPromise) return transporterPromise;
  const cfg = getConfig();

  if (!cfg.SMTP_HOST || !cfg.SMTP_USER || !cfg.SMTP_PASS) {
    transporterPromise = Promise.resolve(null);
    return transporterPromise;
  }

  transporterPromise = (async () => {
    const t = nodemailer.createTransport({
      host: cfg.SMTP_HOST,
      port: cfg.SMTP_PORT,
      secure: false,
      auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS },
    });
    try {
      await t.verify();
      return t;
    } catch (e) {
      console.error("❌ SMTP verify failed:", e?.message || e);
      return null;
    }
  })();

  return transporterPromise;
}

export async function sendVerificationEmail(to, token) {
  const { APP_PUBLIC_URL, SMTP_FROM } = getConfig();
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
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;box-shadow:0 6px 24px rgba(16,24,40,.06);border:1px solid #e5e7eb">
            
            <!-- SUINFI texto a la izquierda -->
            <tr>
              <td style="padding:24px 28px 0 28px;text-align:left">
                <div style="font-weight:800;font-size:22px;letter-spacing:.5px;
                  font-family:system-ui,-apple-system,Segoe UI,Roboto;
                  color:#1f2a44;">
                  SUINFI
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 28px 0 28px;text-align:left">
                <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;font-family:system-ui,-apple-system,Segoe UI,Roboto">
                  Bienvenid@, para activar tu cuenta hacé click en el botón:
                </p>
              </td>
            </tr>

            <!-- Botón (más grande) -->
            <tr>
              <td align="center" style="padding:20px 28px 0 28px">
                <a href="${link}"
                   style="display:inline-block;background:linear-gradient(180deg,#1f2a44,#111827);color:#ffffff;text-decoration:none;
                          padding:14px 24px;border-radius:12px;font-weight:800;font-size:16px;
                          font-family:system-ui,-apple-system,Segoe UI,Roboto;cursor:pointer">
                  Verificar mi correo
                </a>
              </td>
            </tr>

            <!-- Enlace alternativo -->
            <tr>
              <td style="padding:20px 28px 0 28px">
                <p style="margin:0 0 6px 0;color:#64748b;font-size:12px;line-height:1.6;font-family:system-ui,-apple-system,Segoe UI,Roboto">
                  Si el botón no funciona, copiá y pegá este enlace en tu navegador:
                </p>
                <div style="word-break:break-all;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px">
                  <a href="${link}" style="color:#0a0e17;text-decoration:none;font-size:12px;font-family:ui-monospace,monospace">${link}</a>
                </div>
                <p style="margin:10px 0 0 0;color:#94a3b8;font-size:12px;font-family:system-ui,-apple-system,Segoe UI,Roboto">
                  Este enlace expira en 48 horas.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:24px 28px 28px 28px">
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 12px 0"/>
                <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;font-family:system-ui,-apple-system,Segoe UI,Roboto">
                  Recibiste este mensaje porque creaste una cuenta en SUINFI. Si no fuiste vos, podés ignorarlo.
                </p>
              </td>
            </tr>
          </table>

          <div style="color:#94a3b8;font-size:11px;margin-top:12px;font-family:system-ui,-apple-system,Segoe UI,Roboto">
            © ${new Date().getFullYear()} SUINFI
          </div>
        </td>
      </tr>
    </table>
  </div>
  `;

  const transporter = await getTransporter();
  if (!transporter) {
    console.log("📧 [DEV] Enviar a:", to);
    console.log("📧 [DEV] Link:", link);
    return { dev: true };
  }

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
      html,
    });
    console.log("📨 Email enviado:", info?.messageId || "(sin id)");
    return { ok: true, id: info?.messageId };
  } catch (err) {
    console.error("❌ Error enviando verificación:", err?.message || err);
    throw err;
  }
}