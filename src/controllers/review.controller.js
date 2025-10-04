import ReviewModel from "../models/Review.js";
import BookingModel from "../models/Booking.js";
import ProfessionalModel from "../models/Professional.js";
import path from "path";
import { onReviewBonus } from "../services/points.service.js";

// helper: absolutiza /uploads
function relUrlFor(file) {
  const rel = path.join("/uploads/reviews", path.basename(file.path));
  return rel.replace(/\\/g, "/");
}

async function recomputeProfessionalStats(professionalId) {
  const [row] = await ReviewModel.aggregate([
    { $match: { professional: new (await import("mongoose")).default.Types.ObjectId(professionalId), hidden: false } },
    { $group: { _id: "$professional", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const averageRating = row?.avg ? Math.round(row.avg * 10) / 10 : 0;
  const reviews = row?.count || 0;

  await ProfessionalModel.findByIdAndUpdate(
    professionalId,
    { $set: { averageRating, reviews } },
    { new: false, timestamps: false }
  );

  return { averageRating, reviews };
}

// POST /api/reviews
export const createReview = async (req, res) => {
  try {
    const userId = req.user.id; // viene de verifyToken
    const { professionalId, bookingId, rating, comment = "" } = req.body;

    if (!bookingId || !rating) {
      return res.status(400).json({ error: "bookingId y rating son obligatorios" });
    }

    // booking debe existir, pertenecer al cliente y estar completed
    const booking = await BookingModel.findById(bookingId).lean();
    if (!booking || String(booking.client) !== String(userId)) {
      return res.status(404).json({ error: "Reserva no encontrada o no autorizada" });
    }
    if (booking.status !== "completed") {
      return res.status(400).json({ error: "Solo podés reseñar reservas completadas" });
    }

    // profesional consistente
    const profIdFromBooking = String(booking.professional);
    if (professionalId && String(professionalId) !== profIdFromBooking) {
      return res.status(400).json({ error: "El profesional no coincide con la reserva" });
    }

    // una sola review por booking
    const exists = await ReviewModel.findOne({ booking: bookingId });
    if (exists) return res.status(400).json({ error: "Esta reserva ya fue reseñada" });

    const photos = Array.isArray(req.files)
      ? req.files.map((f) => ({
          url: relUrlFor(f),
          fileName: f.originalname || "",
          mimeType: f.mimetype || "",
          fileSize: f.size || 0,
        }))
      : [];

    const review = await ReviewModel.create({
      user: userId,
      professional: profIdFromBooking,
      booking: bookingId,
      rating: Math.max(1, Math.min(5, Number(rating))),
      comment: String(comment || "").slice(0, 500),
      photos,
    });

    const stats = await recomputeProfessionalStats(profIdFromBooking);

    try {
      await onReviewBonus({ bookingId, userId });
    } catch (e) {
      // Si ya se otorgó, no es error funcional
      if (e?.code !== 11000) {
        console.warn("points.onReviewBonus:", e?.message || e);
      }
    }    

    return res.status(201).json({ message: "Review creada", review, stats });
  } catch (error) {
    console.error("❌ createReview:", error);
    if (error?.code === 11000) {
      return res.status(400).json({ error: "Esta reserva ya tiene una reseña" });
    }
    return res.status(500).json({ error: "Server error" });
  }
};

// GET /api/reviews/professional/:id?limit=&page=
export const getReviewsForProfessional = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || "10", 10)));
    const page = Math.max(1, parseInt(req.query.page || "1", 10));

    const q = { professional: id, hidden: false };

    const [items, total, stats] = await Promise.all([
      ReviewModel.find(q)
        .populate("user", "name avatarUrl")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ReviewModel.countDocuments(q),
      ProfessionalModel.findById(id).select("averageRating reviews").lean(),
    ]);

    const pages = Math.max(1, Math.ceil(total / limit));
    res.json({
      items,
      page,
      pages,
      total,
      averageRating: stats?.averageRating || 0,
      reviews: stats?.reviews || 0,
    });
  } catch (error) {
    console.error("❌ getReviewsForProfessional:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// GET /api/reviews/me
export const getMyReviews = async (req, res) => {
  try {
    const userId = req.user.id;
    const reviews = await ReviewModel.find({ user: userId })
      .populate("professional", "user")
      .populate("booking", "scheduledAt status")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    console.error("❌ getMyReviews:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// GET /api/reviews/booking/:id  -> existencia/lectura
export const getReviewForBooking = async (req, res) => {
  try {
    const { id } = req.params;
    // seguridad: solo el dueño del booking puede consultar si existe su reseña
    const b = await BookingModel.findById(id).select("client").lean();
    if (!b || String(b.client) !== String(req.user.id)) {
      return res.status(404).json({ error: "Booking no encontrado o no autorizado" });
    }
    const r = await ReviewModel.findOne({ booking: id });
    res.json({ exists: !!r, review: r || null });
  } catch (e) {
    console.error("❌ getReviewForBooking:", e);
    res.status(500).json({ error: "Server error" });
  }
};

// GET /api/reviews/my-pending?professionalId=
export const getMyPendingReviews = async (req, res) => {
  try {
    const userId = req.user.id;
    const { professionalId } = req.query;
    const q = { client: userId, status: "completed" };
    if (professionalId) q.professional = professionalId;

    const bookings = await BookingModel.find(q).select("_id professional scheduledAt").lean();
    const ids = bookings.map((b) => b._id);
    if (!ids.length) return res.json({ pending: [], count: 0 });

    const reviewed = await ReviewModel.find({ booking: { $in: ids } }).select("booking").lean();
    const reviewedSet = new Set(reviewed.map((r) => String(r.booking)));
    const pending = bookings.filter((b) => !reviewedSet.has(String(b._id))).map((b) => b._id);

    res.json({ pending, count: pending.length });
  } catch (e) {
    console.error("❌ getMyPendingReviews:", e);
    res.status(500).json({ error: "Server error" });
  }
};
