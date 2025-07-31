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

// 📌 Obtener todos los servicios
export const getServices = async (req, res) => {
  try {
    const services = await ServiceModel.find().populate("category");
    return res.status(200).json(services);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};
