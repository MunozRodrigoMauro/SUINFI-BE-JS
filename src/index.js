// src/index.js

import path from "path";
import fs from "fs";
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

// 🆕 JWT para validar (opcional) joinUser
import jwt from "jsonwebtoken";

dotenv.config();

// Inicialización de app (DEBE IR ANTES de cualquier uso de app)
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

// 📂 Static /uploads (MOVIDO DESPUÉS de inicializar app)
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve("uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "1d", index: false }));

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

// 🆕 Presencia en memoria (simple)
const onlineUsers = new Set();

// Helper: verificar JWT de forma segura (opcional)
function verifyTokenSafe(token) {
  try {
    const secret = process.env.JWT_SECRET || process.env.JWT_KEY || "changeme";
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------
   🔊 Socket.IO: rooms por usuario + presencia
   - joinUser(payload): payload puede ser string userId o { userId, token }
   - joinRoom / leaveRoom: helpers opcionales por si querés rooms de chat/booking
   - presence:online/offline para que el FE muestre conectado/desconectado
   - whoIsOnline: devuelve arreglo con userIds online (dev)
-------------------------------------------------------------------*/
io.on("connection", (socket) => {
  console.log("🔌 socket conectado:", socket.id);

  // El front puede emitir:
  // socket.emit("joinUser", userId)  // simple
  // o: socket.emit("joinUser", { userId, token }) // validando token opcionalmente
  socket.on("joinUser", (payload) => {
    try {
      let userId =
        typeof payload === "string" ? payload : payload?.userId || null;
      const token =
        payload && typeof payload === "object" ? payload.token : null;

      if (token) {
        const decoded = verifyTokenSafe(token);
        if (!decoded) {
          console.warn("joinUser: token inválido");
          return;
        }
        // si no mandaron userId, usamos el del token
        if (!userId) userId = decoded.id || decoded._id;
        // si mandaron ambos y no coinciden, ignoramos
        if ((decoded.id || decoded._id) && userId && (decoded.id || decoded._id) !== userId) {
          console.warn("joinUser: userId no coincide con token");
          return;
        }
      }

      if (!userId || typeof userId !== "string") return;

      socket.join(userId);
      socket.data.userId = userId;

      // Marcar presencia (si es el primer socket de ese user)
      const room = io.sockets.adapter.rooms.get(userId);
      if (room && room.size === 1) {
        onlineUsers.add(userId);
        io.emit("presence:online", { userId, at: new Date().toISOString() });
      }

      // Ping al propio usuario
      io.to(userId).emit("presence", {
        userId,
        online: true,
        socketId: socket.id,
        at: new Date().toISOString(),
      });

      console.log(`✅ Socket ${socket.id} unido a room de usuario ${userId}`);
    } catch (e) {
      console.error("joinUser error:", e);
    }
  });

  // (Opcional) Rooms genéricas (por chatId, bookingId, etc.)
  socket.on("joinRoom", (room) => {
    if (!room) return;
    socket.join(room);
    console.log(`➡️  ${socket.id} join -> ${room}`);
  });

  socket.on("leaveRoom", (room) => {
    if (!room) return;
    socket.leave(room);
    console.log(`⬅️  ${socket.id} leave -> ${room}`);
  });

  // (Opcional) Debug: listar rooms del socket
  socket.on("debugRooms", () => {
    console.log("Rooms del socket", socket.id, "->", socket.rooms);
  });

  // (Opcional) Obtener lista de userIds online (solo para dev)
  socket.on("whoIsOnline", (cb) => {
    if (typeof cb === "function") cb(Array.from(onlineUsers));
  });

  socket.on("disconnect", (reason) => {
    const userId = socket.data?.userId;
    if (userId) {
      // si es el último socket en la room, marcar offline
      const room = io.sockets.adapter.rooms.get(userId);
      const remaining = room ? room.size - 1 : 0; // el actual ya se fue
      if (remaining <= 0) {
        onlineUsers.delete(userId);
        io.emit("presence:offline", {
          userId,
          at: new Date().toISOString(),
        });
      }
    }
    console.log("🔌 socket desconectado:", socket.id, "motivo:", reason);
  });
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
      { availabilityStrategy: "schedule" }, // 👈 solo a los que eligen agenda
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