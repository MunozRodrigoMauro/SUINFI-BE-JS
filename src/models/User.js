import mongoose from "mongoose";

// const pointSchema = new mongoose.Schema(
//   {
//     lat: { type: Number },
//     lng: { type: Number },
//   },
//   { _id: false }
// );

const addressSchema = new mongoose.Schema(
  {
    country: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    street: { type: String, trim: true, default: "" },
    number: { type: String, trim: true, default: "" },
    unit: { type: String, trim: true, default: "" },
    postalCode: { type: String, trim: true, default: "" },
    // 👇 para que el FE pueda centrar el mapa
    // dentro de addressSchema
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    label: { type: String, trim: true, default: "" }, // dirección amigable opcional
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ["user", "professional", "admin"],
      default: "user",
    },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Professional" }],
    address: { type: addressSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);