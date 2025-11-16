import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    professional: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Professional",
      required: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "completed", "canceled"],
      default: "pending",
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },

    // 🚀 NUEVO: flag para identificar reservas “inmediatas”
    isImmediate: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ⚠️ Importante: por default "not_required" para el flujo SIN seña
    depositPaid: { type: Boolean, default: false },
    deposit: {
      status: {
        type: String,
        enum: ["not_required", "unpaid", "paid"],
        default: "not_required",
      },
      amount: { type: Number, default: 0 },
      provider: { type: String, default: null },
      paymentId: { type: String, default: null },
      paidAt: { type: Date, default: null },
    },

    cancelNote: { type: String, trim: true, default: "" },
    canceledAt: { type: Date, default: null },
    canceledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// 🧩 Índice para acelerar y ayudar a evitar choques de turno en estados activos
// (no es unique para no romper cargas masivas, pero colabora con consultas/locks de aplicación)
bookingSchema.index({
  professional: 1,
  scheduledAt: 1,
  status: 1,
});

export default mongoose.model("Booking", bookingSchema);
