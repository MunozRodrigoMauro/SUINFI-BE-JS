// src/models/Professional.js
import mongoose from "mongoose";

// ---- Subdocumento para archivos/documentación ----
const docSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },          // /uploads/...
    fileName: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },    // solo criminalRecord
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { _id: false }
);

// ---- NUEVO: datos de cobro del profesional ----
const payoutSchema = new mongoose.Schema(
  {
    method: { type: String, enum: ["bank"], default: "bank" }, // simple por ahora
    holderName: { type: String, default: "" },
    docType: { type: String, enum: ["DNI", "CUIT", "CUIL", "PAS", "OTRO"], default: "DNI" },
    docNumber: { type: String, default: "" },

    bankName: { type: String, default: "" },
    cbu: {
      type: String,
      default: "",
      validate: {
        validator: (v) => !v || /^[0-9]{22}$/.test(String(v)),
        message: "CBU inválido (debe tener 22 dígitos)",
      },
    },
    alias: {
      type: String,
      default: "",
      set: (v) => String(v || "").trim().toLowerCase(),
    },

    verified: { type: Boolean, default: false },
    lastVerifiedAt: { type: Date, default: null },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

// ---- Schema principal de Professional ----
const professionalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    services: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    ],

    bio: { type: String, trim: true, maxlength: 500 },

    address: {
      country: { type: String, default: "" },
      state:   { type: String, default: "" },
      city:    { type: String, default: "" },
      street:  { type: String, default: "" },
      number:  { type: String, default: "" },
      unit:    { type: String, default: "" },
      postalCode: { type: String, default: "" },
      label: { type: String, default: "" },
      location: { lat: { type: Number, default: null }, lng: { type: Number, default: null } },
    },

    // GeoJSON [lng, lat]
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },

    lastLocationAt: { type: Date, default: Date.now },
    isAvailableNow: { type: Boolean, default: false },
    lastActivityAt: { type: Date, default: () => new Date() },
    onlineSince:    { type: Date, default: null }, // cuándo se puso disponible manualmente

    availabilitySchedule: {
      type: Map,
      of: { from: String, to: String },
      default: {},
    },

    rating:  { type: Number, default: 0, min: 0, max: 5 },
    reviews: { type: Number, default: 0 },

    phone: { type: String, trim: true, match: /^[0-9\s+()-]{7,20}$/, default: "" },
    showPhone: { type: Boolean, default: true },

    averageRating: { type: Number, default: 0, min: 0, max: 5 },

    availabilityStrategy: { type: String, enum: ["manual", "schedule"], default: "manual" },

    avatarUrl: { type: String, default: "" },

    linkedinUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
      validate: {
        validator: (v) => !v || /^https?:\/\/.+/i.test(String(v)),
        message: "linkedinUrl debe comenzar con http(s)://",
      },
    },

    documents: {
      criminalRecord: { type: docSchema, default: () => ({}) },
      license:        { type: docSchema, default: () => ({}) },
    },

    whatsapp: {
      number:         { type: String, default: "" },
      visible:        { type: Boolean, default: false },
      country:        { type: String, default: "" },
      nationalNumber: { type: String, default: "" },
    },

    nationality: { type: String, default: "" },

    // ==== Seña por profesional ====
    depositEnabled: { type: Boolean, default: false },
    depositAmount: { type: Number, min: 2000, max: 5000, default: null },

    // ==== NUEVO: datos bancarios para liquidaciones ====
    payout: { type: payoutSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// Índice geoespacial
professionalSchema.index({ location: "2dsphere" });
// Índices sugeridos para cron de inactividad
professionalSchema.index({ availabilityStrategy: 1, isAvailableNow: 1, lastActivityAt: 1 });
export default mongoose.model("Professional", professionalSchema);
