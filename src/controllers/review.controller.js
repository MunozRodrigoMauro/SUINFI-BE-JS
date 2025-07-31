import ReviewModel from "../models/Review.js";
import BookingModel from "../models/Booking.js";
import ProfessionalModel from "../models/Professional.js";

// 📌 Crear una review después de una reserva
export const createReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { professionalId, bookingId, rating, comment } = req.body;

    if (!professionalId || !bookingId || !rating) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    // Verificamos si la reserva existe y pertenece al usuario
    const booking = await BookingModel.findOne({ _id: bookingId, user: userId });
    if (!booking) {
      return res.status(404).json({ error: "Booking not found or not authorized" });
    }

    // Verificamos que no haya review previa para esa reserva
    const existingReview = await ReviewModel.findOne({ booking: bookingId });
    if (existingReview) {
      return res.status(400).json({ error: "You already reviewed this booking" });
    }

    // Creamos la nueva review
    const newReview = new ReviewModel({
      user: userId,
      professional: professionalId,
      booking: bookingId,
      rating,
      comment
    });

    await newReview.save();

    // 📌 Actualizamos el averageRating del profesional
    const allReviews = await ReviewModel.find({ professional: professionalId });
    const avgRating =
      allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;

    await ProfessionalModel.findByIdAndUpdate(professionalId, {
      averageRating: avgRating.toFixed(1)
    });

    res.status(201).json({ message: "Review created successfully", review: newReview });
  } catch (error) {
    console.error("❌ Error creating review:", error);
    res.status(500).json({ error: "Server error" });
  }
};


// 📌 Obtener todas las reviews de un profesional
export const getReviewsForProfessional = async (req, res) => {
  try {
    const { id } = req.params;

    const reviews = await ReviewModel.find({ professional: id })
      .populate("user", "name")
      .sort({ createdAt: -1 });

    res.status(200).json(reviews);
  } catch (error) {
    console.error("❌ Error getting professional reviews:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// 📌 Obtener las reviews creadas por el usuario autenticado
export const getMyReviews = async (req, res) => {
  try {
    const userId = req.user.id;

    const reviews = await ReviewModel.find({ user: userId })
      .populate("professional", "description")
      .populate("booking", "date")
      .sort({ createdAt: -1 });

    res.status(200).json(reviews);
  } catch (error) {
    console.error("❌ Error getting user's reviews:", error);
    res.status(500).json({ error: "Server error" });
  }
};
