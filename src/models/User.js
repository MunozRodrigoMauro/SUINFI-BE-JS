// src/models/User.js
import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    country: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },       // 👈 usás "state" en el front
    city: { type: String, trim: true, default: "" },
    street: { type: String, trim: true, default: "" },
    number: { type: String, trim: true, default: "" },
    unit: { type: String, trim: true, default: "" },
    postalCode: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["user", "professional", "admin"], default: "user" },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Professional" }],
    address: { type: addressSchema, default: () => ({}) },   // 👈 NUEVO
  },
  { timestamps: true }
);

const UserModel = mongoose.model("User", userSchema);
export default UserModel;