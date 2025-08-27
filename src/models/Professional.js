import mongoose from "mongoose";

const professionalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    services: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
        required: true,
      },
    ],
    bio: { type: String, trim: true, maxlength: 500 },

    // Dirección "humana" (alineada con User)
    address: {
      country: { type: String, default: "" },
      state: { type: String, default: "" },
      city: { type: String, default: "" },
      street: { type: String, default: "" },
      number: { type: String, default: "" },
      unit: { type: String, default: "" },
      postalCode: { type: String, default: "" },
      // ⬇️ NUEVO: label + location para que el FE pueda leer p.address.location
      label: { type: String, default: "" },
      location: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },

    // GeoJSON [lng, lat] — lo usa /nearby
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },

    lastLocationAt: { type: Date, default: Date.now },

    isAvailableNow: { type: Boolean, default: false },
    availabilitySchedule: {
      type: Map,
      of: { from: String, to: String },
      default: {},
    },

    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviews: { type: Number, default: 0 },

    phone: {
      type: String,
      trim: true,
      match: /^[0-9\s+()-]{7,20}$/,
      default: "",
    },
    showPhone: { type: Boolean, default: true },

    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    availabilityStrategy: {
      type: String,
      enum: ["manual", "schedule"],
      default: "manual",
    },

    avatarUrl: { type: String, default: "" },
    documents: {
      criminalRecordUrl: { type: String, default: "" },
      credentialUrl: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

// Índice geoespacial correcto
professionalSchema.index({ location: "2dsphere" });

export default mongoose.model("Professional", professionalSchema);
