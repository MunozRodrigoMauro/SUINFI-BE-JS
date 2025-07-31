// Importamos las dependencias principales
import express from "express";           // Framework para crear el servidor HTTP
import mongoose from "mongoose";         // ODM para conectarse y trabajar con MongoDB
import dotenv from "dotenv";             // Permite usar variables de entorno desde .env
import userRoutes from "./routes/user.routes.js"; // Importamos las rutas de usuarios
import authRoutes from "./routes/auth.routes.js"; // Importamos las rutas de autenticación
import serviceRoutes from "./routes/service.routes.js"; // Importamos las rutas de servicios
import categoryRoutes from "./routes/category.routes.js"; // Importamos las rutas de categorías
import professionalRoutes from "./routes/professional.routes.js"; // Importamos las rutas de perfiles profesionales
import bookingRoutes from "./routes/booking.routes.js"; // Importamos las rutas de reservas
import reviewRoutes from "./routes/review.routes.js"; // Importamos las rutas de reviews
import favoritesRoutes from "./routes/favorite.routes.js"; // Importamos las rutas de favoritos
import chatRoutes from "./routes/chat.routes.js"; // Importamos las rutas de chats
import notificationRoutes from "./routes/notification.routes.js"; // Importamos las rutas de notificaciones
import paymentRoutes from "./routes/payments.routes.js"; // Importamos las rutas de pagos

dotenv.config(); // Carga las variables de entorno del archivo .env

const app = express(); // Creamos la aplicación de Express

app.use(express.json()); // Permite que el servidor entienda JSON en las peticiones
// 📌 Middleware para usar el router de usuarios
// Todas las rutas dentro de user.routes.js estarán bajo /api/users
app.use("/api/users", userRoutes);

// 📌 Middleware para usar el router de autenticación
// Todas las rutas dentro de auth.routes.js estarán bajo /api/auth
app.use("/api/auth", authRoutes);

// Ruta base para probar si el servidor funciona
app.get("/", (req, res) => {
  res.send("Bienvenido a la API de SUINFI 🎯");
});

// 👇 Agregamos este middleware después de los otros
app.use("/api/services", serviceRoutes); // Todas las rutas de servicios comienzan con /api/services

// 📌 Rutas para categorías (ej: /api/categories)
app.use("/api/categories", categoryRoutes);

// 📌 Rutas para perfiles profesionales
app.use("/api/professionals", professionalRoutes);

// 📌 Rutas para reservas
app.use("/api/bookings", bookingRoutes);

// 📌 Rutas para chats
app.use("/api/chats", chatRoutes);

// 📌 Rutas para notificaciones
app.use("/api/notifications", notificationRoutes);

// 📌 Rutas para pagos
app.use("/api/payments", paymentRoutes);

// 🟩 Buena práctica: las variables del entorno no deben hardcodearse
const PORT = process.env.PORT || 3000;           // Puerto configurable
const MONGO_URI = process.env.MONGO_URI;         // URI de conexión a MongoDB

// 📌 Rutas para reviews
app.use("/api/reviews", reviewRoutes);

// 📌 Rutas para favoritos
app.use("/api/favorites", favoritesRoutes);

// Conectamos a la base de datos y levantamos el servidor
mongoose.connect(MONGO_URI)
  .then(() => {
    // 🟩 Buena práctica: solo levantamos el servidor si la DB está conectada
    app.listen(PORT, () => {
      console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    // 🟩 Buena práctica: manejo de errores al conectar a la base de datos
    console.error("❌ Error al conectar a Mongo:", err);
  });
