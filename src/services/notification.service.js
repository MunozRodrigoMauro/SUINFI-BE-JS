import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import { sendNotificationEmail } from "./mailer.js";
import Booking from "../models/Booking.js";

const APP_NAME = process.env.APP_NAME || "CuyIT";
const DELAY_MIN = Number(process.env.NOTIF_EMAIL_DELAY_MINUTES || 5);
const APP_URL = process.env.APP_PUBLIC_URL || "http://localhost:5173";

/* -------------------- helpers de render -------------------- */
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function nl2br(s = "") {
  return escapeHtml(s).replace(/\n/g, "<br/>");
}

/* helper para formatear fecha/hora en AR forzando zona horaria */
const AR_TIME_FMT = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Argentina/Buenos_Aires",
};
function formatARDate(value) {
  return new Date(value).toLocaleString("es-AR", AR_TIME_FMT);
}

/** Misma estética que el mail de verificación */
function buildBrandedHtml({ title, message, ctaHref, ctaLabel = "Abrir en CuyIT", bodyHtml }) {
  return `
  <div style="margin:0;padding:0;background:#f7f8fb">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fb;padding:24px 0">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;box-shadow:0 6px 24px rgba(16,24,40,.06);border:1px solid #e5e7eb">
          <tr><td style="padding:24px 28px 0 28px;text-align:left">
            <div style="font-weight:800;font-size:22px;letter-spacing:.5px;font-family:system-ui,-apple-system,Segoe UI,Roboto;color:#1f2a44;">${APP_NAME}</div>
          </td></tr>

          <tr><td style="padding:16px 28px 0 28px;text-align:left">
            <h1 style="margin:0 0 8px 0;color:#0a0e17;font-size:20px;font-family:system-ui,-apple-system,Segoe UI,Roboto">${escapeHtml(title)}</h1>
            ${
              bodyHtml
                ? bodyHtml
                : `<p style="margin:0;color:#475569;font-size:14px;line-height:1.6;font-family:system-ui,-apple-system,Segoe UI,Roboto">${nl2br(message || "")}</p>`
            }
          </td></tr>

          <tr><td align="center" style="padding:20px 28px 20PX 28px">
            <a href="${ctaHref}" style="display:inline-block;background:linear-gradient(180deg,#1f2a44,#111827);color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:800;font-size:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto;cursor:pointer">
              ${escapeHtml(ctaLabel)}
            </a>
          </td></tr>

          <tr><td style="padding:24px 28px 28px 28px">
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 12px 0"/>
            <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;font-family:system-ui,-apple-system,Segoe UI,Roboto">
              Si ya viste esta actividad, podés ignorar este correo.
            </p>
          </td></tr>
        </table>
        <div style="color:#94a3b8;font-size:11px;margin-top:12px;font-family:system-ui,-apple-system,Segoe UI,Roboto">© ${new Date().getFullYear()} ${APP_NAME}</div>
      </td></tr>
    </table>
  </div>`;
}

/* Crea la notificación (el envío lo hace el cron / dispatcher) */
export async function queueNotification({
  recipient,
  type,
  subject,
  message,
  metadata = {},
  notBefore = new Date(),
}) {
  return await Notification.create({
    recipient,
    type,
    subject: subject || `Notificación`,
    message,
    metadata,
    notBefore,
    channel: "email",
    status: "pending",
  });
}

/* ------------------------ BOOKING ------------------------ */

export async function notifyBookingCreated({ booking }) {
  const recipient = booking?.professional?.user?._id || booking?.professional?.user;
  if (!recipient) return;

  const when = new Date(booking.scheduledAt);
  const whenStr = formatARDate(when);
  const clientName = booking?.client?.name || "Cliente";
  const serviceName = booking?.service?.name || "Servicio";

  // detectamos inmediata también por nota
  const noteLower = String(booking?.note || "").toLowerCase();
  const isImmediate =
    booking?.isImmediate === true ||
    noteLower.includes("reserva inmediata");

  const subject = isImmediate ? `Nueva Reserva Inmediata` : `Nueva Reserva`;
  const message =
    `Tipo: ${isImmediate ? "Reserva inmediata" : "Reserva programada"}\n` +
    `Cliente: ${clientName}\n` +
    `Tarea: ${serviceName}\n` +
    `Día y horario: ${whenStr}`;

  await queueNotification({
    recipient,
    type: "booking",
    subject,
    message,
    metadata: {
      bookingId: String(booking._id),
      clientId: String(booking.client?._id || booking.client),
      professionalId: String(booking.professional?._id || booking.professional),
      serviceName,
      clientName,
      scheduledAt: booking?.scheduledAt,
      kind: "created",
      isImmediate,
    },
    notBefore: new Date(),
  });
}

export async function notifyBookingCanceledByClient({ booking }) {
  const recipient = booking?.professional?.user?._id || booking?.professional?.user;
  if (!recipient) return;

  const subject = `Reserva Cancelada`;
  const whenStr = formatARDate(booking.scheduledAt);
  const clientName = booking?.client?.name || "Cliente";
  const serviceName = booking?.service?.name || "Servicio";
  const cancelReason =
    [booking?.cancelNote, booking?.note]
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .find((v) => !!v) || "No especificado";

  const message = `La reserva del ${whenStr} fue cancelada por el cliente. Motivo: ${cancelReason}`;

  await queueNotification({
    recipient,
    type: "booking",
    subject,
    message,
    metadata: {
      bookingId: String(booking._id),
      kind: "canceled_by_client",
      scheduledAt: booking?.scheduledAt,
      clientName,
      serviceName,
      cancelReason,
    },
    notBefore: new Date(),
  });
}

export async function notifyBookingCanceledByPro({ booking }) {
  const recipient = booking?.client?._id || booking?.client;
  if (!recipient) return;

  const subject = `Reserva Cancelada`;
  const whenStr = formatARDate(booking.scheduledAt);
  const professionalName = booking?.professional?.user?.name || "Profesional";
  const serviceName = booking?.service?.name || "Servicio";
  const cancelReason = (booking?.cancelNote || booking?.note || "").trim() || "No especificado";

  const message = `Tu reserva del ${whenStr} fue cancelada por el profesional. Motivo: ${cancelReason}`;

  await queueNotification({
    recipient,
    type: "booking",
    subject,
    message,
    metadata: {
      bookingId: String(booking._id),
      kind: "canceled_by_pro",
      scheduledAt: booking?.scheduledAt,
      professionalName,
      serviceName,
    },
    notBefore: new Date(),
  });
}

/* ------------------------- CHAT -------------------------- */

export async function notifyChatMessageDeferred({ messageDoc, sender, recipient }) {
  const subject = `Nuevo mensaje`;
  const textSender = sender?.name || "alguien";
  const msgText =
    messageDoc.text.length > 120
      ? messageDoc.text.slice(0, 117) + "..."
      : messageDoc.text;

  const message = `Tenés un mensaje de ${textSender}: “${msgText}”.`;

  const createdAt = new Date(messageDoc.createdAt || Date.now());
  const notBefore = new Date(createdAt.getTime() + DELAY_MIN * 60 * 1000);

  await queueNotification({
    recipient,
    type: "message",
    subject,
    message,
    metadata: {
      chatId: String(messageDoc.chat),
      messageId: String(messageDoc._id),
      fromUserId: String(sender?._id || sender),
      fromName: textSender,
    },
    notBefore,
  });
}

/* ------------- Dispatcher helper (usado por cron) ------------- */
export async function dispatchEmailForNotification(notif) {
  // Mensajes: no enviar si ya fue leído
  if (notif.type === "message" && notif?.metadata?.messageId) {
    const msg = await Message.findById(notif.metadata.messageId).lean();
    if (!msg) {
      await Notification.findByIdAndUpdate(notif._id, { status: "skipped" });
      return { skipped: true, reason: "message_not_found" };
    }
    if (msg.readAt) {
      await Notification.findByIdAndUpdate(notif._id, {
        status: "read",
        read: true,
      });
      return { skipped: true, reason: "already_read" };
    }
  }

  // vamos a necesitar estos dos más abajo
  let bookingDoc = null;
  let effectiveIsImmediate = !!notif?.metadata?.isImmediate;

  // Bookings: no enviar si el pro ya aceptó/rechazó
  if (notif.type === "booking" && notif?.metadata?.bookingId) {
    const b = await Booking.findById(notif.metadata.bookingId).lean();
    bookingDoc = b; // lo guardamos para abajo
    if (!b) {
      await Notification.findByIdAndUpdate(notif._id, { status: "skipped" });
      return { skipped: true, reason: "booking_not_found" };
    }
    const kind = notif?.metadata?.kind;
    if (kind === "created" || kind === "canceled_by_client") {
      if (b.status === "accepted" || b.status === "rejected") {
        await Notification.findByIdAndUpdate(notif._id, {
          status: "skipped",
        });
        return { skipped: true, reason: "pro_already_acted" };
      }
    }

    // [CAMBIO DISPATCHER] recalcular si era inmediata mirando el booking real
    if (!effectiveIsImmediate) {
      const noteLower = String(b.note || "").toLowerCase();
      if (b.isImmediate === true || noteLower.includes("reserva inmediata")) {
        effectiveIsImmediate = true;
      }
    }
  }

  // destinatario
  const user = await User.findById(notif.recipient, "email name").lean();
  if (!user?.email) {
    await Notification.findByIdAndUpdate(notif._id, { status: "skipped" });
    return { skipped: true, reason: "no_email" };
  }

  // CTA con redirect
  let redirectPath = "/dashboard";
  if (notif.type === "booking" && notif?.metadata?.bookingId) {
    redirectPath = `/bookings/${notif.metadata.bookingId}`;
  } else if (notif.type === "message" && notif?.metadata?.chatId) {
    redirectPath = `/chats/${notif.metadata.chatId}`;
  }
  const ctaHref = `${APP_URL}/login?redirect=${encodeURIComponent(
    redirectPath
  )}`;

  // Cuerpo HTML
  let bodyHtml = null;

  if (notif.type === "booking" && notif?.metadata?.kind === "created") {
    const clientName = notif?.metadata?.clientName || bookingDoc?.client?.name || "Cliente";
    const serviceName = notif?.metadata?.serviceName || bookingDoc?.service?.name || "Servicio";
    const whenStr = notif?.metadata?.scheduledAt
      ? formatARDate(notif.metadata.scheduledAt)
      : bookingDoc?.scheduledAt
      ? formatARDate(bookingDoc.scheduledAt)
      : "";
    bodyHtml = `
      <div style="margin:0;color:#475569;font-size:14px;line-height:1.8;font-family:system-ui,-apple-system,Segoe UI,Roboto">
        <div><strong>Tipo:</strong> ${effectiveIsImmediate ? "Reserva inmediata" : "Reserva programada"}</div>
        <div><strong>Cliente:</strong> ${escapeHtml(clientName)}</div>
        <div><strong>Tarea:</strong> ${escapeHtml(serviceName)}</div>
        <div><strong>Día y horario:</strong> ${escapeHtml(whenStr)}</div>
      </div>`;
  }

  if (notif.type === "booking" && notif?.metadata?.kind === "canceled_by_client") {
    const clientName = notif?.metadata?.clientName || "Cliente";
    const serviceName = notif?.metadata?.serviceName || "Servicio";
    const reason = notif?.metadata?.cancelReason || "No especificado";
    const whenStr = notif?.metadata?.scheduledAt
      ? formatARDate(notif.metadata.scheduledAt)
      : "";
    bodyHtml = `
      <div style="margin:0;color:#475569;font-size:14px;line-height:1.8;font-family:system-ui,-apple-system,Segoe UI,Roboto">
        <div><strong>Cliente:</strong> ${escapeHtml(clientName)}</div>
        <div><strong>Tarea:</strong> ${escapeHtml(serviceName)}</div>
        <div><strong>Motivo:</strong> ${escapeHtml(reason)}</div>
        <div><strong>Día y horario:</strong> ${escapeHtml(whenStr)}</div>
      </div>`;
  }

  if (notif.type === "booking" && notif?.metadata?.kind === "canceled_by_pro") {
    const proName = notif?.metadata?.professionalName || "Profesional";
    const serviceName = notif?.metadata?.serviceName || "Servicio";
    const whenStr = notif?.metadata?.scheduledAt
      ? formatARDate(notif.metadata.scheduledAt)
      : "";
    bodyHtml = `
      <div style="margin:0;color:#475569;font-size:14px;line-height:1.8;font-family:system-ui,-apple-system,Segoe UI,Roboto">
        <div><strong>Profesional:</strong> ${escapeHtml(proName)}</div>
        <div><strong>Tarea:</strong> ${escapeHtml(serviceName)}</div>
        <div><strong>Día y horario:</strong> ${escapeHtml(whenStr)}</div>
      </div>`;
  }

  // [CAMBIO DISPATCHER] si al final resultó ser inmediata, forzamos el asunto
  let subjectToSend = notif.subject || `Notificación`;
  if (
    notif.type === "booking" &&
    notif?.metadata?.kind === "created" &&
    effectiveIsImmediate
  ) {
    subjectToSend = "Nueva Reserva Inmediata";
  }

  const html = buildBrandedHtml({
    title: subjectToSend,
    message: notif.message,
    ctaHref,
    ctaLabel: "Abrir en CuyIT",
    bodyHtml,
  });

  const sent = await sendNotificationEmail({
    to: user.email,
    subject: subjectToSend,
    html,
    text: notif.message,
  });

  if (sent?.ok || sent?.dev) {
    await Notification.findByIdAndUpdate(notif._id, {
      status: "sent",
      sentAt: new Date(),
    });
    return { sent: true };
  } else {
    return { sent: false };
  }
}
