// src/models/Notification.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  read: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    enum: ["booking", "message", "review", "status"],
    required: true
  },
  metadata: {
    type: Object, // Por si queremos guardar el ID de una reserva, etc.
    default: {}
  }
}, {
  timestamps: true
});

const NotificationModel = mongoose.model("Notification", notificationSchema);
export default NotificationModel;
