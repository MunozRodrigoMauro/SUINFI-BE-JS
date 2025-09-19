import mongoose from "mongoose";

const refundSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["none", "initiated", "refunded", "failed"], default: "none" },
    amount: { type: Number, default: 0 },
    reason: { type: String, default: "" },
    provider: { type: String, enum: ["manual", "mercadopago"], default: "manual" },
    externalId: { type: String, default: "" }, // id de MP o ref de transferencia
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // admin
    processedAt: { type: Date, default: null },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    provider: {
      type: String,
      enum: ["mercadopago", "manual"],
      default: "manual",
    },
    details: {
      type: Object,
      default: {},
    },

    // NUEVO: reembolso manual / MP
    refund: { type: refundSchema, default: () => ({}) },
  },
  { timestamps: true }
);

const PaymentModel = mongoose.model("Payment", paymentSchema);
export default PaymentModel;
