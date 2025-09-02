// al final del archivo (o junto a las otras exports)
export async function sendNotificationEmail({ to, subject, html, text }) {
    const { SMTP_FROM } = getConfig();
    const transporter = await getTransporter();
    if (!transporter) {
      console.log("📧 [DEV] Notif →", to, subject);
      return { dev: true };
    }
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text: text || "",
      html: html || `<p>${text || subject || "Notificación"}</p>`,
    });
    return { ok: true, id: info?.messageId };
  }
  