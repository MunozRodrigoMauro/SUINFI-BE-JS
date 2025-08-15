// src/index.js
// Importamos las dependencias principales
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

// Rutas
import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import professionalRoutes from "./routes/professional.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import favoritesRoutes from "./routes/favorite.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import paymentRoutes from "./routes/payments.routes.js";
import clientRoutes from "./routes/client.routes.js";
import adminRoutes from "./routes/admin.routes.js";

// Cron + util de agenda
import cron from "node-cron";
import isNowWithinSchedule from "./utils/schedule.js";

// Modelos
import ProfessionalModel from "./models/Professional.js";

// 🔌 HTTP + Socket.IO
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

dotenv.config();

const app = express();
app.use(express.json());

// CORS para el front local
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 🚀 HTTP server + Socket.IO
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
  transports: ["websocket", "polling"],
  pingTimeout: 20000,
  pingInterval: 25000,
});

// Hacemos IO accesible desde controladores: req.app.get('io')
app.set("io", io);

// Eventos de conexión
io.on("connection", (socket) => {
  console.log("🔌 socket conectado:", socket.id);
  socket.on("disconnect", () => {});
});

// Rutas
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/professionals", professionalRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/admins", adminRoutes);

// Ruta base
app.get("/", (_req, res) => {
  res.send("Bienvenido a la API de SUINFI 🎯");
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Conexión y arranque
mongoose
  .connect(MONGO_URI)
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Error al conectar a Mongo:", err);
  });

/**
 * ⏱️ Cron: sincroniza isAvailableNow con availabilitySchedule cada minuto
 * - Usa updateOne + $set para evitar validaciones de otros campos
 * - Emite "availability:update" por Socket.IO cuando cambie el valor (mismo nombre que el front)
 */
cron.schedule("* * * * *", async () => {
  try {
    const pros = await ProfessionalModel.find(
      {},
      { _id: 1, user: 1, isAvailableNow: 1, availabilitySchedule: 1 }
    );

    for (const p of pros) {
      const shouldBeOn = isNowWithinSchedule(p.availabilitySchedule);

      if (p.isAvailableNow !== shouldBeOn) {
        await ProfessionalModel.updateOne(
          { _id: p._id },
          { $set: { isAvailableNow: shouldBeOn } },
          { timestamps: false }
        );

        io.emit("availability:update", {
          userId: p.user.toString(),
          isAvailableNow: shouldBeOn,
          at: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.error("Cron availability error:", e);
  }
});