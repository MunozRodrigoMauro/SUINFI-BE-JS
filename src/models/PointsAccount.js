import mongoose from "mongoose";

const PointsAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, index: true, required: true },
    balance: { type: Number, default: 0 },
    // Si luego querés manejar expiración por lotes, podés sumar un arreglo de lotes.
  },
  { timestamps: true }
);

export default mongoose.model("PointsAccount", PointsAccountSchema);
