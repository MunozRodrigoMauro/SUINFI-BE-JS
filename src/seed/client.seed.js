import mongoose from "mongoose";
import dotenv from "dotenv";
import { faker } from "@faker-js/faker/locale/es";
import UserModel from "../models/User.js";
import ClientModel from "../models/Client.js";
import bcrypt from "bcrypt";

dotenv.config();
const MONGO_URI = process.env.MONGO_URI;

const seedClients = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Conectado a MongoDB (Clients)");

    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash("Cliente123", salt);

    const users = await UserModel.insertMany(
      Array.from({ length: 5 }).map(() => ({
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: hashedPass,
        role: "client"
      }))
    );

    const clients = users.map((user) => ({
      user: user._id,
      phone: faker.phone.number("+54 9 11 #### ####"),
      address: faker.location.streetAddress(),
      preferences: {
        notifications: faker.helpers.arrayElement(["email", "sms"]),
        theme: faker.helpers.arrayElement(["light", "dark"])
      }
    }));

    await ClientModel.insertMany(clients);
    console.log("✅ Clients seed completos");
  } catch (err) {
    console.error("❌ Error al crear clients:", err);
  } finally {
    mongoose.connection.close();
  }
};

seedClients();