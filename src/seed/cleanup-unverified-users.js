// src/seed/cleanup-unverified-users.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import UserModel from "../models/User.js";
import ProfessionalModel from "../models/Professional.js";

dotenv.config();
const MONGO_URI = process.env.MONGO_URI;

const cleanupUnverifiedUsers = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("📡 Conectado a MongoDB");

    // Buscar usuarios no verificados
    const unverifiedUsers = await UserModel.find({ verified: { $ne: true } });
    const unverifiedIds = unverifiedUsers.map((u) => u._id);

    if (unverifiedIds.length === 0) {
      console.log("✅ No hay usuarios no verificados para eliminar.");
      return;
    }

    console.log(`⚠️ Se encontraron ${unverifiedIds.length} usuarios no verificados.`);

    // Borrar perfiles profesionales asociados
    const prosDeleted = await ProfessionalModel.deleteMany({ user: { $in: unverifiedIds } });
    console.log(`🗑️ Eliminados ${prosDeleted.deletedCount} perfiles profesionales asociados`);

    // Borrar usuarios no verificados
    const usersDeleted = await UserModel.deleteMany({ _id: { $in: unverifiedIds } });
    console.log(`🗑️ Eliminados ${usersDeleted.deletedCount} usuarios no verificados`);

    console.log("✅ Limpieza completada");
  } catch (err) {
    console.error("❌ Error en cleanup:", err);
  } finally {
    mongoose.connection.close();
  }
};

cleanupUnverifiedUsers();