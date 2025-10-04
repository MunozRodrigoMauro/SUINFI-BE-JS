import mongoose from "mongoose";

const RewardSchema = new mongoose.Schema(
  {
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: "Partner", required: true, index: true },
    title: { type: String, required: true },
    subtitle: String,
    pointsCost: { type: Number, required: true },
    quotaMonthly: { type: Number, default: 50 },
    active: { type: Boolean, default: true },
    terms: String,
    level: { type: String, default: "L1" },
  },
  { timestamps: true }
);

export default mongoose.model("Reward", RewardSchema);
