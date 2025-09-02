import mongoose from "mongoose";

const photoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true }, // /uploads/reviews/...
    fileName: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
  },
  { _id: false }
);

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    professional: { type: mongoose.Schema.Types.ObjectId, ref: "Professional", required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 500, default: "" },
    photos: { type: [photoSchema], default: [] },
    hidden: { type: Boolean, default: false }, // moderación futura
  },
  { timestamps: true }
);

// índice auxiliar
reviewSchema.index({ professional: 1, createdAt: -1 });

export default mongoose.model("Review", reviewSchema);
