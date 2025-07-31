import UserModel from "../models/User.js";
import ProfessionalModel from "../models/Professional.js";

// 📌 Agregar a favoritos
export const addFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const { professionalId } = req.body;

    if (!professionalId) {
      return res.status(400).json({ error: "Professional ID is required" });
    }

    const professional = await ProfessionalModel.findById(professionalId);
    if (!professional) {
      return res.status(404).json({ error: "Professional not found" });
    }

    const user = await UserModel.findById(userId);

    if (user.favorites.includes(professionalId)) {
      return res.status(400).json({ error: "Professional already in favorites" });
    }

    user.favorites.push(professionalId);
    await user.save();

    res.status(200).json({ message: "Added to favorites" });
  } catch (error) {
    console.error("❌ Error adding favorite:", error);
    res.status(500).json({ error: "Server error" });
  }
};


// 📌 Eliminar de favoritos
export const removeFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const { professionalId } = req.body;

    const user = await UserModel.findById(userId);
    user.favorites = user.favorites.filter(id => id.toString() !== professionalId);
    await user.save();

    res.status(200).json({ message: "Removed from favorites" });
  } catch (error) {
    console.error("❌ Error removing favorite:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// 📌 Obtener favoritos del usuario
export const getFavorites = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await UserModel.findById(userId)
      .populate("favorites", "description phone services");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(user.favorites);
  } catch (error) {
    console.error("❌ Error getting favorites:", error);
    res.status(500).json({ error: "Server error" });
  }
};

