import ServiceModel from "../models/Service.js"; // Importamos el modelo

// 📌 Crear un nuevo servicio
export const createService = async (req, res) => {
  try {
    const { name, description, price } = req.body;

    // Validamos campos requeridos
    if (!name || price === undefined) {
      return res.status(400).json({ message: "Name and price are required" });
    }

    // Creamos y guardamos el nuevo servicio
    const newService = new ServiceModel({ name, description, price });
    const savedService = await newService.save();

    return res.status(201).json(savedService);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

// controllers/service.controller.js
export const getServices = async (req, res) => {
  try {
    const { categoryId, q } = req.query;

    // 🔍 Armamos el filtro condicional
    const filter = {};

    if (categoryId) {
      filter.category = categoryId;
    }

    if (q) {
      filter.name = { $regex: q, $options: 'i' }; // Búsqueda case-insensitive por nombre
    }

    const items = await ServiceModel.find(filter).select("name description price category");
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
};

