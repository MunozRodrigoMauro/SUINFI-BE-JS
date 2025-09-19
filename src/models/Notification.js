// src/models/Notification.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Texto corto visible en el centro de notificaciones
    message: { type: String, required: true, trim: true },

    // Título / asunto para email
    subject: { type: String, trim: true },

    read: { type: Boolean, default: false },

    type: {
      type: String,
      enum: ["booking", "message", "review", "status"],
      required: true,
    },

    // Orquestación de envío
    channel: { type: String, enum: ["email"], default: "email" },
    status: { type: String, enum: ["pending", "sent", "skipped", "read"], default: "pending" },
    notBefore: { type: Date, default: () => new Date() }, // cuándo se puede enviar
    sentAt: { type: Date },

    metadata: { type: Object, default: {} }, // bookingId / chatId / messageId / fromName / etc.
  },
  { timestamps: true }
);

// Índices útiles
notificationSchema.index({ status: 1, notBefore: 1 });
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

const NotificationModel = mongoose.model("Notification", notificationSchema);
export default NotificationModel;