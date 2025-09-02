// src/services/notification.service.js
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import { sendNotificationEmail } from "./mailer.no-logo.js";

const APP_NAME = process.env.APP_NAME || "SUINFI";
const DELAY_MIN = Number(process.env.NOTIF_EMAIL_DELAY_MINUTES || 5);

// Crea la notificación, no envía (eso lo hace el cron)
export async function queueNotification({
  recipient, type, subject, message, metadata = {}, notBefore = new Date()
}) {
  return await Notification.create({
    recipient,
    type,
    subject: subject || `[${APP_NAME}] Notificación`,
    message,
    metadata,
    notBefore,
    channel: "email",
    status: "pending",
  });
}

/* ------------------------ BOOKING ------------------------ */

export async function notifyBookingCreated({ booking }) {
  // destinatario = user del profesional
  const recipient = booking?.professional?.user?._id || booking?.professional?.user;
  if (!recipient) return;

  const when = new Date(booking.scheduledAt);
  const subject = `[${APP_NAME}] Nueva reserva`;
  const message = `Tenés una nueva reserva de ${booking?.client?.name || "un cliente"} para ${booking?.service?.name || "un servicio"} el ${when.toLocaleString()}.`;

  await queueNotification({
    recipient,
    type: "booking",
    subject,
    message,
    metadata: {
      bookingId: String(booking._id),
      clientId: String(booking.client?._id || booking.client),
      professionalId: String(booking.professional?._id || booking.professional),
      serviceName: booking?.service?.name,
      scheduledAt: booking?.scheduledAt,
      kind: "created",
    },
    notBefore: new Date(), // inmediato
  });
}

export async function notifyBookingCanceledByClient({ booking }) {
  const recipient = booking?.professional?.user?._id || booking?.professional?.user;
  if (!recipient) return;

  const subject = `[${APP_NAME}] Reserva cancelada por el cliente`;
  const message = `La reserva del ${new Date(booking.scheduledAt).toLocaleString()} fue cancelada por el cliente.`;

  await queueNotification({
    recipient,
    type: "booking",
    subject,
    message,
    metadata: {
      bookingId: String(booking._id),
      kind: "canceled_by_client",
    },
    notBefore: new Date(),
  });
}

export async function notifyBookingCanceledByPro({ booking }) {
  const recipient = booking?.client?._id || booking?.client;
  if (!recipient) return;

  const subject = `[${APP_NAME}] Reserva cancelada por el profesional`;
  const message = `Tu reserva del ${new Date(booking.scheduledAt).toLocaleString()} fue cancelada por el profesional.`;

  await queueNotification({
    recipient,
    type: "booking",
    subject,
    message,
    metadata: {
      bookingId: String(booking._id),
      kind: "canceled_by_pro",
    },
    notBefore: new Date(),
  });
}

/* ------------------------- CHAT -------------------------- */

export async function notifyChatMessageDeferred({ messageDoc, sender, recipient }) {
  const subject = `[${APP_NAME}] Nuevo mensaje`;
  const textSender = sender?.name || "alguien";
  const msgText = messageDoc.text.length > 120
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
  // Si es de mensaje, verificar que siga no leído
  if (notif.type === "message" && notif?.metadata?.messageId) {
    const msg = await Message.findById(notif.metadata.messageId).lean();
    if (!msg) {
      await Notification.findByIdAndUpdate(notif._id, { status: "skipped" });
      return { skipped: true, reason: "message_not_found" };
    }
    if (msg.readAt) {
      await Notification.findByIdAndUpdate(notif._id, { status: "read", read: true });
      return { skipped: true, reason: "already_read" };
    }
  }

  // armar destinatario y HTML
  const user = await User.findById(notif.recipient, "email name").lean();
  if (!user?.email) {
    await Notification.findByIdAndUpdate(notif._id, { status: "skipped" });
    return { skipped: true, reason: "no_email" };
  }

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto">
      <h2>${notif.subject || `[${APP_NAME}] Notificación`}</h2>
      <p>${notif.message}</p>
      <p style="color:#64748b;font-size:12px;margin-top:16px">
        Si ya viste esta actividad, podés ignorar este correo.
      </p>
    </div>
  `;

  const sent = await sendNotificationEmail({
    to: user.email,
    subject: notif.subject || `[${APP_NAME}] Notificación`,
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
    // no marcamos nada especial; se reintenta en el próximo ciclo
    return { sent: false };
  }
}
