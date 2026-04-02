// src/seed/professionals.seed.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import { faker } from "@faker-js/faker/locale/es";
import ProfessionalModel from "../models/Professional.js";
import UserModel from "../models/User.js";
import ServiceModel from "../models/Service.js";

dotenv.config();
const MONGO_URI = process.env.MONGO_URI;

const generateRandomCoords = () => {
  return {
    lat: -34.55 + Math.random() * 0.15,
    lng: -58.5 + Math.random() * 0.2,
  };
};

const seedProfessionals = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("📡 Connected to MongoDB");

    const services = await ServiceModel.find();
    if (services.length === 0) {
      console.log("⚠️ No services found in DB");
      return;
    }

    // ✅ Creamos 10 usuarios con rol professional
    const usersData = Array.from({ length: 10 }).map(() => ({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(10),
      role: "professional",
    }));

    const createdUsers = await UserModel.insertMany(usersData);

    // ✅ Creamos los perfiles profesionales
    const professionals = createdUsers.map((user) => {
      const coords = generateRandomCoords(); // { lat, lng }

      return {
        user: user._id,
        services: [faker.helpers.arrayElement(services)._id],
        bio: faker.person.jobTitle(),
        location: {
            type: "Point",
            coordinates: [coords.lng, coords.lat], // ⚠️ ORDEN CORRECTO: [lng, lat]
          },
        isAvailableNow: faker.datatype.boolean(),
        availabilitySchedule: {
          lunes: { from: "09:00", to: "17:00" },
          viernes: { from: "14:00", to: "19:00" },
        },
        phone: "+54 9 11 " + faker.string.numeric(4) + " " + faker.string.numeric(4),
        showPhone: faker.datatype.boolean(),
      };
    });

    await ProfessionalModel.insertMany(professionals);
    console.log("✅ Professionals seeded!");
  } catch (err) {
    console.error("❌ Error seeding professionals:", err);
  } finally {
    mongoose.connection.close();
  }
};

seedProfessionals();
