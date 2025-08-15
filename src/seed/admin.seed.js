import mongoose from "mongoose";
import dotenv from "dotenv";
import { faker } from "@faker-js/faker/locale/es";
import UserModel from "../models/User.js";
import AdminModel from "../models/Admin.js";
import bcrypt from "bcrypt";

dotenv.config();
const MONGO_URI = process.env.MONGO_URI;

const seedAdmins = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Conectado a MongoDB (Admins)");

    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash("Admin123", salt);

    const users = await UserModel.insertMany(
      Array.from({ length: 3 }).map(() => ({
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: hashedPass,
        role: "admin"
      }))
    );

    const admins = users.map((user) => ({
      user: user._id,
      permissions: ["manage_users", "view_reports"],
      lastLogin: new Date(),
      activityLogs: ["Seeded admin created"]
    }));

    await AdminModel.insertMany(admins);
    console.log("✅ Admins seed completos");
  } catch (err) {
    console.error("❌ Error al crear admins:", err);
  } finally {
    mongoose.connection.close();
  }
};

seedAdmins();