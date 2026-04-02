// src/models/Service.js
import mongoose from "mongoose"; // ODM de MongoDB
import { capitalizeWords } from "../utils/capitalizeWords.js";
import { slugify } from "../utils/slugify.js";

function cleanStringArray(values = []) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();

  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((value) => capitalizeWords(value))
    .filter((value) => {
      const key = slugify(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// 🟩 BUENA PRÁCTICA: definir esquemas con campos y restricciones claras
const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,     // El nombre del servicio es obligatorio
    trim: true,         // Quita espacios en blanco al principio y al final
  },
  slug: {
    type: String,
    unique: true, // 🟩 Evita duplicados en slugs
    index: true   // 🔎 Mejora rendimiento en búsquedas
  },
  description: {
    type: String,
    trim: true,
    default: ""         // Si no se pasa, queda vacío
  },
  price: {
    type: Number,
    required: true,
    min: 0              // 🟩 Validación: no se permiten precios negativos
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true
  },
  aliases: {
    type: [String],
    default: []
  },
  tags: {
    type: [String],
    default: []
  },
}, {
  timestamps: true // 🟩 Crea automáticamente createdAt y updatedAt
});

// 🛠 Middleware: antes de guardar, capitalizamos el name y generamos el slug
serviceSchema.pre("save", function (next) {
  if (this.name) {
    this.name = capitalizeWords(this.name);   // Ej: "masaje relajante" → "Masaje Relajante"
    this.slug = slugify(this.name);           // Ej: "Masaje Relajante" → "masaje-relajante"
  }

  this.aliases = cleanStringArray(this.aliases);
  this.tags = cleanStringArray(this.tags);

  next();
});

// Creamos el modelo y lo exportamos
const ServiceModel = mongoose.model("Service", serviceSchema);
export default ServiceModel;