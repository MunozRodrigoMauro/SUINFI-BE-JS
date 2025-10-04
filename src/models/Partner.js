import mongoose from "mongoose";

const PartnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    logoUrl: String,
    contact: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Partner", PartnerSchema);
