// src/models/User.js

import mongoose from "mongoose"; // ODM para MongoDB

// 🟩 Buena práctica: definir esquemas con restricciones claras
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,         // El nombre es obligatorio
    trim: true              // Quita espacios antes y después
  },
  email: {
    type: String,
    required: true,
    unique: true,           // No se pueden repetir
    lowercase: true         // Lo guarda todo en minúsculas
  },
  password: {
    type: String,
    required: true,
    minlength: 6            // Mínimo de seguridad
  },
  role: {
    type: String,
    enum: ['user', 'professional', 'admin'], // Tipos válidos
    default: 'user'
  },
  favorites: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Professional",
    },
  ],
}, {
  timestamps: true          // 🟩 Crea automáticamente createdAt y updatedAt
});

// Exportamos el modelo
const UserModel = mongoose.model('User', userSchema);
export default UserModel;
