import mongoose from "mongoose";

export const POINT_TYPES = {
  BOOKING_BASE: "BOOKING_BASE",
  BOOKING_DEPOSIT_BONUS: "BOOKING_DEPOSIT_BONUS",
  REVIEW_BONUS: "REVIEW_BONUS",
  REFERRAL_BONUS: "REFERRAL_BONUS",
  ADJUSTMENT: "ADJUSTMENT",
  REDEMPTION_DEBIT: "REDEMPTION_DEBIT",
};

const PointsTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    type: { type: String, enum: Object.values(POINT_TYPES), required: true },
    points: { type: Number, required: true }, // + o -
    meta: {
      bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", index: true },
      referralId: { type: mongoose.Schema.Types.ObjectId, index: true }, // si usás Referral
      note: String,
      source: String,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Idempotencia por booking y referral
PointsTransactionSchema.index({ userId: 1, type: 1, "meta.bookingId": 1 }, { unique: true, sparse: true });
PointsTransactionSchema.index({ userId: 1, type: 1, "meta.referralId": 1 }, { unique: true, sparse: true });

export default mongoose.model("PointsTransaction", PointsTransactionSchema);
