import mongoose from "mongoose"; // ODM de MongoDB
import { capitalizeWords } from "../utils/capitalizeWords.js";
import { slugify } from "../utils/slugify.js";

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
}, {
  timestamps: true // 🟩 Crea automáticamente createdAt y updatedAt
});

// 🛠 Middleware: antes de guardar, capitalizamos el name y generamos el slug
serviceSchema.pre("save", function (next) {
    if (this.name) {
      this.name = capitalizeWords(this.name);   // Ej: "masaje relajante" → "Masaje Relajante"
      this.slug = slugify(this.name);           // Ej: "Masaje Relajante" → "masaje-relajante"
    }
    next();
  });

// Creamos el modelo y lo exportamos
const ServiceModel = mongoose.model("Service", serviceSchema);
export default ServiceModel;