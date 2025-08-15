// src/scripts/fixMissingProfessionalLocation.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import ProfessionalModel from "../models/Professional.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

// Coordenadas por defecto (CABA centro aprox). Podés cambiarlas.
const DEFAULT_POINT = { type: "Point", coordinates: [-58.3816, -34.6037] };

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("📡 Conectado a Mongo");

  const toFix = await ProfessionalModel.find({
    $or: [
      { location: { $exists: false } },
      { "location.coordinates": { $exists: false } },
      { "location.coordinates": { $size: 0 } },
      { "location.type": { $ne: "Point" } }
    ]
  }).select("_id location user");

  console.log(`🔎 Profesionales a corregir: ${toFix.length}`);

  for (const p of toFix) {
    await ProfessionalModel.updateOne(
      { _id: p._id },
      {
        $set: {
          location: p.location?.type === "Point" && Array.isArray(p.location.coordinates)
            ? { type: "Point", coordinates: p.location.coordinates }
            : DEFAULT_POINT
        }
      },
      { timestamps: false }
    );
  }

  console.log("✅ Migración completada.");
  await mongoose.disconnect();
}

run().catch(err => {
  console.error("❌ Error en migración:", err);
  process.exit(1);
});