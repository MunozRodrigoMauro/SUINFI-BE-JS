import mongoose from "mongoose";
import { capitalizeWords } from "../utils/capitalizeWords.js";
import { slugify } from "../utils/slugify.js";

// 🟩 Esquema para categorías de servicios
const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    toLowerCase: true
  },
  slug: {
    type: String,
    unique: true,
    index: true
  }
}, {
  timestamps: true
});

// 🎯 Middleware: normaliza y genera slug automáticamente
categorySchema.pre("save", function (next) {
  if (this.name) {
    this.name = capitalizeWords(this.name);  // "coaching financiero" → "Coaching Financiero"
    this.slug = slugify(this.name);          // "Coaching Financiero" → "coaching-financiero"
  }
  next();
});

// Exportamos el modelo
const CategoryModel = mongoose.model("Category", categorySchema);
export default CategoryModel;
