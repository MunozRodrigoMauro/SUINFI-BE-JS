// Importamos el modelo de datos del usuario
// Este modelo representa cómo se guarda un usuario en MongoDB
import UserModel from "../models/User.js";
import bcrypt from "bcrypt"; // Librería para encriptar contraseñas
import jwt from "jsonwebtoken";
import ProfessionalModel from "../models/Professional.js";


// 🟩 BUENA PRÁCTICA: Cada función del controlador maneja una ruta específica.

// 📌 Función para crear un nuevo usuario
export const createUser = async (req, res) => {
  try {
    // Desestructuración del cuerpo de la solicitud (body)
    // Significa que extraemos directamente estas propiedades del objeto req.body
    // En vez de escribir: const name = req.body.name; etc.
    const { name, email, password, role } = req.body;

    // Validamos que los campos obligatorios estén presentes
    if (!name || !email || !password || !role) { 
      // Si falta alguno, respondemos con estado 400 (Bad Request)
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Verificamos si el email ya está registrado
    const userExist = await UserModel.findOne({ email });
    if (userExist) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // 🔐 Encriptamos la contraseña antes de guardarla
    const saltRounds = 10; // 🟩 Buena práctica: 10 es un buen número de rondas
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Creamos una nueva instancia del modelo UserModel con los datos recibidos
    const user = new UserModel({
      name,     // nombre del usuario
      email,    // email único del usuario
      password: hashedPassword, // Guardamos la contraseña encriptada
      role      // puede ser "user", "professional" o "admin"
    });

    // Guardamos el usuario en la base de datos con await (esperamos la promesa)
    const savedUser = await user.save(); // Método de Mongoose para insertar en MongoDB

    // 🟢 Generar token igual que en login
    const token = jwt.sign(
      {
        id: savedUser._id,
        role: savedUser.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN,
      }
    );

    // 🟩 NUNCA devolvemos la contraseña al frontend
    const userToReturn = {
      _id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email,
      role: savedUser.role,
      createdAt: savedUser.createdAt
    };

    // Respondemos al cliente con estado 201 (Created) y el usuario creado
    return res.status(201).json({ userToReturn, token });
  } catch (error) {
    // Si ocurre un error, respondemos con estado 500 (Internal Server Error)
    return res.status(500).json({ message: "Server error", error });
  }
};

// 📌 Función para obtener todos los usuarios
export const getUsers = async (req, res) => {
  try {
    // Buscamos todos los usuarios en la base usando Mongoose
    const users = await UserModel.find(); // Devuelve un array de usuarios

    // Respondemos con los usuarios encontrados
    return res.status(200).json(users);
  } catch (error) {
    // Si algo sale mal, devolvemos error de servidor
    return res.status(500).json({ message: "Server error", error });
  }
};

// 📌 Obtiene los datos del usuario autenticado usando el token
export const getMe = async (req, res) => {
  try {
    // 🟩 El middleware verifyToken ya puso los datos en req.user
    const userId = req.user.id;

    // 🔍 Buscamos al usuario por su ID
    const user = await UserModel.findById(userId).select("-password"); // ⚠️ No devolver la contraseña

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("❌ Error al obtener perfil:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

// ✅ Actualizar perfil del usuario autenticado (robusto con save())
export const updateMe = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;   // por si viene como _id
    const { name, password } = req.body;

    // Log rápido para ver qué llega (podés quitarlo después)
    // console.log({ userId, body: req.body });

    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name && name !== user.name) user.name = name;

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const bcrypt = (await import("bcrypt")).default;
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save(); // <-- dispara timestamps y validaciones del schema

    // devolvemos sin la password
    const { password: _, ...userSafe } = user.toObject();
    return res.status(200).json({ user: userSafe });
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// 👉 Obtener MI perfil profesional
export const getMyProfile = async (req, res) => {
  try {
    const u = req.user; // o cargalo como lo haces ahora
    const prof = await ProfessionalModel.findOne({ user: u.id }, "location").lean();

    const hasName = (u.name || "").trim().length >= 2;
    const hasAvatar = (u.avatarUrl || "").trim().length > 0; // si no usás avatar, dejalo en false
    const hasLocation = !!(prof?.location?.coordinates?.length === 2);

    const requiresOnboarding = !(hasName && hasLocation); // avatar opcional por ahora

    res.json({ user: u, requiresOnboarding });
  } catch (e) {
    console.error("❌ getMyProfile:", e);
    res.status(500).json({ error: "Server error" });
  }
};