import UserModel from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// 📌 Función para login de usuario 
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validamos que se manden los datos
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // Buscamos el usuario por email
    const user = await UserModel.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Comparamos la contraseña ingresada con la encriptada
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generamos token JWT
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role
      },
      process.env.JWT_SECRET, // 3️⃣ Una clave secreta (como una contraseña maestra)
      {
        expiresIn: process.env.JWT_EXPIRES_IN // 4️⃣ Tiempo de validez (ej: "1h", "7d")
      }
    );

    // Devolvemos el token y datos del usuario (sin la contraseña)
    res.status(200).json({
      message: "Login successful",
      token, // Token que luego usaremos para proteger rutas
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};