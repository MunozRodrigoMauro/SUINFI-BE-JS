import CategoryModel from "../models/Category.js";

/**
 * 📌 Crear una nueva categoría
 * POST /api/categories
 */
export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    // Validación simple: que venga el nombre
    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    // Verificamos que no exista ya una categoría con el mismo nombre
    const existing = await CategoryModel.findOne({ name });

    if (existing) {
      return res.status(409).json({ message: "Category already exists" });
    }

    // Creamos y guardamos
    const category = new CategoryModel({ name });
    const savedCategory = await category.save();

    return res.status(201).json(savedCategory);

  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

/**
 * 📌 Obtener todas las categorías
 * GET /api/categories
 */
export const getAllCategories = async (req, res) => {
  try {
    const categories = await CategoryModel.find().sort({ name: 1 }); // Orden alfabético
    return res.status(200).json(categories);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

/**
 * 📌 Buscar categoría por slug
 * GET /api/categories/:slug
 */
export const getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await CategoryModel.findOne({ slug });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.status(200).json(category);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};
