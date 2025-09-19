import mongoose from "mongoose";

const payoutSchema = new mongoose.Schema(
  {
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    professional: { type: mongoose.Schema.Types.ObjectId, ref: "Professional", required: true },

    amount: { type: Number, required: true },
    currency: { type: String, default: "ARS" },

    status: { type: String, enum: ["pending", "paid", "failed", "canceled"], default: "paid" },
    method: { type: String, enum: ["bank"], default: "bank" },

    // Snapshot de datos de cobro del profesional (para auditoría)
    snapshot: {
      holderName: String,
      docType: String,
      docNumber: String,
      bankName: String,
      cbu: String,
      alias: String,
    },

    notes: { type: String, default: "" },

    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // admin
    processedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

export default mongoose.model("Payout", payoutSchema);
