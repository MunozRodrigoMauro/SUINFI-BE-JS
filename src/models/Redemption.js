import mongoose from "mongoose";

export const REDEMPTION_STATUS = { ISSUED: "ISSUED", REDEEMED: "REDEEMED", CANCELLED: "CANCELLED" };

const RedemptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    rewardId: { type: mongoose.Schema.Types.ObjectId, ref: "Reward", index: true, required: true },
    cost: { type: Number, required: true }, // snapshot
    code: { type: String, unique: true, index: true, required: true },
    status: { type: String, enum: Object.values(REDEMPTION_STATUS), default: REDEMPTION_STATUS.ISSUED },
    issuedAt: { type: Date, default: Date.now },
    redeemedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Redemption", RedemptionSchema);
