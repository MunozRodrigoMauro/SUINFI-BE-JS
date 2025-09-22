// src/index.js
import path from "path";
import fs from "fs";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import professionalRoutes from "./routes/professional.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import clientRoutes from "./routes/client.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { debugVerifySmtp } from "./services/mailer.js";
import paymentRoutes from "./routes/payments.routes.js";
import startCleanupUnpaidPrebookings from "./scripts/cleanupUnpaidPrebookings.js";
import startCleanupUnpaid from "./scripts/cleanupUnpaidBookings.js";

import cron from "node-cron";
import isNowWithinSchedule from "./utils/schedule.js";
import { registerNotificationsCron } from "./utils/notifications-cron.js";

import ProfessionalModel from "./models/Professional.js";

import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";

import whatsappRoutes from "./routes/whatsapp.routes.js";

dotenv.config();

import UserModel from "./models/User.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { ensureProfileByRole } from "./services/ensureProfile.js";
import {
  getGoogleAuthURL,
  getTokens,
  getGoogleUser,
} from "./services/googleOAuth.js";

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve("uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "1d", index: false }));

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

app.set("io", io);

const onlineUsers = new Set();

function verifyTokenSafe(token) {
  try {
    const secret = process.env.JWT_SECRET || process.env.JWT_KEY || "changeme";
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

io.on("connection", (socket) => {
  console.log("🔌 socket conectado:", socket.id);

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
        if (!userId) userId = decoded.id || decoded._id;
        if ((decoded.id || decoded._id) && userId && (decoded.id || decoded._id) !== userId) {
          console.warn("joinUser: userId no coincide con token");
          return;
        }
      }

      if (!userId || typeof userId !== "string") return;

      socket.join(userId);
      socket.data.userId = userId;
      console.log("[SOCKET] joinUser userId=%s socket=%s", userId, socket.id);
      touchActivity(userId);

      const room = io.sockets.adapter.rooms.get(userId);
      if (room && room.size === 1) {
        onlineUsers.add(userId);
        io.emit("presence:online", { userId, at: new Date().toISOString() });
      }

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

  // 💓 Heartbeat del cliente (solo registra actividad)
  socket.on("heartbeat", async () => {
    const uid = socket.data?.userId;
    if (!uid) return;
    await touchActivity(uid);
    console.log("[HB] userId=%s at=%s", uid, new Date().toISOString());
  });

  async function touchActivity(userId) {
    try {
      if (!userId) return;
      await ProfessionalModel.updateOne(
        { user: userId },
        { $set: { lastActivityAt: new Date() } },
        { timestamps: false }
      );
    } catch (e) {
      console.warn("socket touchActivity:", e?.message || e);
    }
  }

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

  socket.on("debugRooms", () => {
    console.log("Rooms del socket", socket.id, "->", socket.rooms);
  });

  socket.on("whoIsOnline", (cb) => {
    if (typeof cb === "function") cb(Array.from(onlineUsers));
  });

  socket.on("disconnect", (reason) => {
    const userId = socket.data?.userId;
    if (userId) {
      const room = io.sockets.adapter.rooms.get(userId);
      const remaining = room ? room.size - 1 : 0;
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

app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/professionals", professionalRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/admins", adminRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/payments", paymentRoutes);

// Google OAuth (igual que tenías) ...
app.get("/api/auth/google", (req, res) => {
  const next =
    typeof req.query.next === "string" && req.query.next ? req.query.next : "";
  const url = getGoogleAuthURL(next);
  return res.redirect(url);
});

app.get("/api/auth/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).send("Missing code");

    let next = "/dashboard/user";
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(String(state), "base64url").toString());
        if (decoded?.next && typeof decoded.next === "string") next = decoded.next;
      } catch {}
    }

    const { id_token, access_token } = await getTokens({ code });
    const g = await getGoogleUser(id_token, access_token);
    const { sub, email, name, picture, email_verified } = g || {};

    if (!email) return res.status(400).send("Google account without email");

    let user = await UserModel.findOne({ email });

    if (!user) {
      const randomPass = crypto.randomBytes(24).toString("hex");
      const hashed = await bcrypt.hash(randomPass, 10);
      user = await UserModel.create({
        name: name || email.split("@")[0],
        email,
        password: hashed,
        role: "user",
        verified: true,
        avatarUrl: picture || "",
        googleId: sub,
        authProvider: "google",
      });
      await ensureProfileByRole(user);
    } else {
      const patch = {};
      if (!user.googleId && sub) patch.googleId = sub;
      if (email_verified && !user.verified) patch.verified = true;
      if (!user.avatarUrl && picture) patch.avatarUrl = picture;
      if (Object.keys(patch).length) {
        user = await UserModel.findByIdAndUpdate(user._id, { $set: patch }, { new: true });
      }
    }

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role },
      process.env.JWT_SECRET || "changeme",
      { expiresIn: process.env.JWT_EXPIRES_IN || "30d" }
    );

    const appUrl = process.env.APP_PUBLIC_URL || "http://localhost:5173";
    const redirectUrl = `${appUrl}/oauth/google/callback?token=${encodeURIComponent(
      token
    )}&next=${encodeURIComponent(next)}`;
    return res.redirect(redirectUrl);
  } catch (e) {
    console.error("Google OAuth callback error:", e);
    return res.status(500).send("Google sign-in failed");
  }
});

app.get("/", (_req, res) => {
  res.send("Bienvenido a la API de CuyIT 🎯");
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then(() => {
    registerNotificationsCron();
    debugVerifySmtp();
    startCleanupUnpaid();
    startCleanupUnpaidPrebookings();

    httpServer.listen(PORT, () => {
      console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Error al conectar a Mongo:", err);
  });

/* ───────── Helpers schedule ───────── */
function todayKey() {
  const days = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  return days[new Date().getDay()];
}
function nowHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function isBoundaryNow(scheduleRaw = {}) {
  const day = todayKey();
  const slot = scheduleRaw?.[day];
  if (!slot || !slot.from || !slot.to) return false;
  const hhmm = nowHHMM();
  return hhmm === slot.from || hhmm === slot.to;
}

/* ───────── CRON por schedule ─────────
   Solo aplica ON/OFF EN LOS LÍMITES (from/to).
   Entre medio, respeta los cambios manuales temporales.
*/
cron.schedule("* * * * *", async () => {
  try {
    const pros = await ProfessionalModel.find(
      { availabilityStrategy: "schedule" },
      { _id:1, user:1, isAvailableNow:1, availabilitySchedule:1 }
    );

    console.log("[CRON schedule:scan] count=", pros.length);

    for (const p of pros) {
      const raw = p.availabilitySchedule instanceof Map
        ? Object.fromEntries(p.availabilitySchedule)
        : (p.availabilitySchedule || {});
      const hasAnySlot = Object.values(raw).some(v => v && v.from && v.to);
      if (!hasAnySlot) {
        console.log("[CRON schedule:skip empty] user=%s", p.user.toString());
        continue;
      }

      // 🚦 Sólo en los bordes (from/to) se aplica el estado del schedule
      if (!isBoundaryNow(raw)) {
        continue;
      }

      const shouldBeOn = isNowWithinSchedule(raw);
      if (p.isAvailableNow !== shouldBeOn) {
        console.log("[CRON schedule:update] user=%s %s -> %s",
          p.user.toString(), p.isAvailableNow, shouldBeOn);

        await ProfessionalModel.updateOne(
          { _id: p._id },
          { $set: { isAvailableNow: shouldBeOn, onlineSince: shouldBeOn ? new Date() : null } },
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

/* ───────── Auto-desconexión por inactividad ─────────
   Aplica a:
   - modo MANUAL (siempre)
   - modo SCHEDULE pero sólo cuando está FUERA del horario
*/
const INACTIVITY_MIN = Number(process.env.INACTIVITY_MINUTES || 1);

cron.schedule("*/10 * * * * *", async () => {
  try {
    const threshold = new Date(Date.now() - INACTIVITY_MIN * 60 * 1000);
    console.log("[CRON idle:scan] threshold=%s", threshold.toISOString());

    const cursor = ProfessionalModel.find(
      {
        isAvailableNow: true,
        onlineSince: { $ne: null },
      },
      { _id:1, user:1, lastActivityAt:1, onlineSince:1, availabilityStrategy:1, availabilitySchedule:1 }
    ).cursor();

    for await (const p of cursor) {
      const userId = p.user.toString();

      // ¿Debemos aplicar inactividad a este pro?
      let applyInactivity = true;
      if (p.availabilityStrategy === "schedule") {
        const raw = p.availabilitySchedule instanceof Map
          ? Object.fromEntries(p.availabilitySchedule)
          : (p.availabilitySchedule || {});
        // Si ESTÁ dentro del horario programado, no aplicamos inactividad
        if (isNowWithinSchedule(raw)) {
          applyInactivity = false;
        }
      }

      const effectiveLast = new Date(Math.max(
        p.lastActivityAt ? p.lastActivityAt.getTime() : 0,
        p.onlineSince ? p.onlineSince.getTime() : 0
      ));

      // logging de sockets (no condiciona)
      const room = io.sockets.adapter.rooms.get(userId);
      const sockets = room ? room.size : 0;
      console.log("[CRON idle:consider] user=%s last=%s sockets=%d strategy=%s apply=%s",
        userId, effectiveLast.toISOString(), sockets, p.availabilityStrategy || "n/a", applyInactivity);

      if (!applyInactivity) continue;

      if (effectiveLast >= threshold) {
        console.log("[CRON idle:keep] user=%s (recent activity)", userId);
        continue;
      }

      await ProfessionalModel.updateOne(
        { _id: p._id },
        { $set: { isAvailableNow: false, onlineSince: null } },
        { timestamps: false }
      );

      console.log("[CRON idle:off] user=%s nowOff", userId);

      const payload = { userId, isAvailableNow: false, at: new Date().toISOString() };
      io.emit("availability:update", payload);
      io.to(userId).emit("availability:self", payload);
    }
  } catch (e) {
    console.error("Cron inactivity error:", e);
  }
});
