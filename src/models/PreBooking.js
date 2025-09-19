// src/models/PreBooking.js
import mongoose from "mongoose";

const preBookingSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    professional: { type: mongoose.Schema.Types.ObjectId, ref: "Professional", required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },

    scheduledAt: { type: Date, required: true },
    note: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },

    isImmediate: { type: Boolean, default: false },

    amount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["pending", "approved", "expired", "canceled"],
      default: "pending",
      index: true,
    },

    mpPreferenceId: { type: String, default: null, index: true },
    mpPaymentId: { type: String, default: null },

    createdBookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("PreBooking", preBookingSchema);
