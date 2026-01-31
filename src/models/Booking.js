//src/models/Booking.js
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
      index: true,
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

    // ✅ [CAMBIO] metadata para SLA + fallback de inmediatas
    immediate: {
      firstOfferedAt: { type: Date, default: null },
      currentOfferAt: { type: Date, default: null, index: true },
      expiresAt: { type: Date, default: null, index: true },
      offeredProfessionals: [{ type: mongoose.Schema.Types.ObjectId, ref: "Professional" }],
      fallbackCount: { type: Number, default: 0 },
      lastFallbackAt: { type: Date, default: null },
      expiredAt: { type: Date, default: null },

      // ✅ CAMBIO UBER: criterios usados para el matching (cercanía + filtros)
      criteria: {
        clientLocation: {
          type: { type: String, enum: ["Point"], default: "Point" },
          coordinates: { type: [Number], default: null }, // [lng, lat]
        },
        maxDistance: { type: Number, default: null }, // metros
        requireCriminalRecord: { type: Boolean, default: true },
        requireLicense: { type: Boolean, default: false },
        minAverageRating: { type: Number, default: null },
        minReviews: { type: Number, default: null },
      },
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

// ✅ [CAMBIO] índices para cron inmediatas
bookingSchema.index({ isImmediate: 1, status: 1, "immediate.currentOfferAt": 1 });
bookingSchema.index({ isImmediate: 1, status: 1, "immediate.expiresAt": 1 });

export default mongoose.model("Booking", bookingSchema);
