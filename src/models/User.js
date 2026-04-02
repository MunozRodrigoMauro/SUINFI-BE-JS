// src/models/User.js
import mongoose from "mongoose";
import ProfessionalModel from "./Professional.js";
import ClientModel from "./Client.js";
import AdminModel from "./Admin.js";

const addressSchema = new mongoose.Schema(
  {
    country: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    street: { type: String, trim: true, default: "" },
    number: { type: String, trim: true, default: "" },
    unit: { type: String, trim: true, default: "" },
    postalCode: { type: String, trim: true, default: "" },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    label: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const emailVerificationSchema = new mongoose.Schema(
  {
    token: { type: String, default: "" },
    expiresAt: { type: Date, default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50, // <- límite duro
      minlength: 2,
      match: [/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/u, "Invalid name characters"],
    },
    email: { type: String, required: true, unique: true, lowercase: true },
    // 🛠 CAMBIO: password requerido solo para 'local'
    password: {
      type: String,
      required: function () {
        return this.authProvider === "local";
      },
      minlength: 6,
    },
    // 🛠 CAMBIO: role requerido sin default
    role: {
      type: String,
      enum: ["user", "professional", "admin"],
      required: true,
    },
    favorites: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Professional",
      default: [],
    },
    address: { type: addressSchema, default: () => ({}) },
    verified: { type: Boolean, default: false },
    emailVerification: { type: emailVerificationSchema, default: () => ({}) },
    avatarUrl: { type: String, default: "" },

    // 🔐 Reset de contraseña
    passwordResetTokenHash: { type: String, index: true, default: null },
    passwordResetExpiresAt: { type: Date, default: null },

    whatsapp: {
      number: { type: String, default: "" }, // E.164 (+54...)
      visible: { type: Boolean, default: false },
      country: { type: String, default: "" }, // ISO-2
      nationalNumber: { type: String, default: "" },
    },

    nationality: { type: String, default: "" },

    // 🆕 OAuth
    googleId: { type: String, index: true, sparse: true, default: null },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },

    // 🆕 PUSH (Expo)
    expoPushTokens: { type: [String], default: [] },
  },
  { timestamps: true }
);

// índices útiles
userSchema.index({ "emailVerification.token": 1 });
userSchema.index({ passwordResetTokenHash: 1, passwordResetExpiresAt: 1 });

// 👉 borra perfiles dependientes al eliminar un usuario
userSchema.pre("findOneAndDelete", async function (next) {
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
  } catch (e) {
    next(e);
  }
});

export default mongoose.model("User", userSchema);
