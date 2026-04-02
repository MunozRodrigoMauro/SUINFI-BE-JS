// src/controllers/service.controller.js
import ServiceModel from "../models/Service.js";
import CategoryModel from "../models/Category.js";
import { sendServiceSuggestionEmail } from "../services/mailer.js";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function cleanStringArray(values = []) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();

  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeText(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildSearchText(service, categoryName = "") {
  const chunks = [
    service?.name || "",
    service?.description || "",
    ...(Array.isArray(service?.aliases) ? service.aliases : []),
    ...(Array.isArray(service?.tags) ? service.tags : []),
    categoryName || "",
  ];

  return normalizeText(chunks.join(" "));
}

// 📌 Crear un nuevo servicio
export const createService = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      aliases = [],
      tags = [],
    } = req.body;

    // Validamos campos requeridos
    if (!name || price === undefined || !category) {
      return res.status(400).json({
        message: "El nombre, el precio y la categoría son obligatorios",
      });
    }

    const existingCategory = await CategoryModel.findById(category).lean();
    if (!existingCategory) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    // Creamos y guardamos el nuevo servicio
    const newService = new ServiceModel({
      name,
      description,
      price,
      category,
      aliases: cleanStringArray(aliases),
      tags: cleanStringArray(tags),
    });

    const savedService = await newService.save();

    return res.status(201).json(savedService);
  } catch (error) {
    return res.status(500).json({ message: "Error del servidor", error });
  }
};

// controllers/service.controller.js
export const getServices = async (req, res) => {
  try {
    const { categoryId, q } = req.query;

    // 🔍 Armamos el filtro condicional mínimo sin romper el front
    const filter = {};

    if (categoryId) {
      filter.category = categoryId;
    }

    const items = await ServiceModel.find(filter)
      .select("name description price category aliases tags")
      .lean();

    if (!q) {
      return res.json(items);
    }

    const normalizedQuery = normalizeText(q);
    const categoryIds = [
      ...new Set(
        items
          .map((item) => String(item.category || ""))
          .filter(Boolean)
      ),
    ];

    const categories = await CategoryModel.find({ _id: { $in: categoryIds } })
      .select("_id name")
      .lean();

    const categoryNameById = new Map(
      categories.map((category) => [String(category._id), String(category.name || "")])
    );

    const filteredItems = items.filter((item) => {
      const categoryName = categoryNameById.get(String(item.category || "")) || "";
      const searchText = buildSearchText(item, categoryName);
      return searchText.includes(normalizedQuery);
    });

    return res.json(filteredItems);
  } catch (e) {
    return res.status(500).json({ message: "Error del servidor" });
  }
};

export const suggestService = async (req, res) => {
  try {
    const suggestedName = String(req.body?.suggestedName || "").trim();
    const details = String(req.body?.details || "").trim();

    if (suggestedName.length < 2) {
      return res.status(400).json({
        message: "La sugerencia debe tener al menos 2 caracteres",
      });
    }

    const userName = String(req.user?.name || "").trim();
    const userEmail = String(req.user?.email || "").trim();
    const userRole = String(req.user?.role || "").trim();

    await sendServiceSuggestionEmail({
      suggestedName,
      details,
      userName,
      userEmail,
      userRole,
    });

    return res.status(200).json({
      message: "Sugerencia enviada correctamente",
    });
  } catch (error) {
    return res.status(500).json({
      message: "No pudimos enviar la sugerencia. Probá más tarde.",
    });
  }
};