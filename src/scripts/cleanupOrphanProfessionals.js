// scripts/cleanupOrphanProfessionals.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Professional from "../models/Professional.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const pros = await Professional.find().populate("user", "_id verified");
  const orphans = pros.filter(p => !p.user);
  if (!orphans.length) {
    console.log("✔ No hay profesionales huérfanos.");
    process.exit(0);
  }
  console.log(`Encontrados ${orphans.length} huérfanos. Eliminando...`);
  const ids = orphans.map(p => p._id);
  await Professional.deleteMany({ _id: { $in: ids } });
  console.log("✔ Listo.");
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });