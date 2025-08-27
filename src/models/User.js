// src/models/User.js
import mongoose from "mongoose";
import ProfessionalModel from "./Professional.js";
import ClientModel from "./Client.js";
import AdminModel from "./Admin.js";

const addressSchema = new mongoose.Schema({
  country: { type: String, trim: true, default: "" },
  state:   { type: String, trim: true, default: "" },
  city:    { type: String, trim: true, default: "" },
  street:  { type: String, trim: true, default: "" },
  number:  { type: String, trim: true, default: "" },
  unit:    { type: String, trim: true, default: "" },
  postalCode: { type: String, trim: true, default: "" },
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  label: { type: String, trim: true, default: "" },
}, { _id: false });

const emailVerificationSchema = new mongoose.Schema({
  token: { type: String, default: "" },
  expiresAt: { type: Date, default: null },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  role:     { type: String, enum: ["user", "professional", "admin"], default: "user" },
  favorites:{ type: [mongoose.Schema.Types.ObjectId], ref: "Professional", default: [] },
  address:  { type: addressSchema, default: () => ({}) },
  verified: { type: Boolean, default: false },
  emailVerification: { type: emailVerificationSchema, default: () => ({}) },
}, { timestamps: true });

// 👉 índice para búsquedas por token
userSchema.index({ "emailVerification.token": 1 });

// 👉 borra perfiles dependientes al eliminar un usuario
userSchema.pre("findOneAndDelete", async function(next) {
  try {
    const doc = await this.model.findOne(this.getFilter()).lean();
    if (doc?._id) {
      const uid = doc._id;
      await Promise.all([
        ProfessionalModel.deleteOne({ user: uid }),
        ClientModel.deleteOne({ user: uid }),
        AdminModel.deleteOne?.({ user: uid }) ?? Promise.resolve(),
      ]);
    }
    next();
  } catch (e) { next(e); }
});

export default mongoose.model("User", userSchema);