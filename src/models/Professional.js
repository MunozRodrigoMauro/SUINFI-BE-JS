import mongoose from "mongoose";

const professionalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true // Cada profesional está asociado a un único user
  },
  services: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true
    }
  ],
  bio: {
    type: String,
    trim: true,
    maxlength: 500
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true
    }
  },
  isAvailableNow: {
    type: Boolean,
    default: false // 🛑 Hasta que el profesional diga “Estoy disponible”3
  },
  availabilitySchedule: {
    type: Map,
    of: {
      from: String, // Ej: "18:00"
      to: String    // Ej: "23:30"
    },
    default: {}
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviews: {
    type: Number,
    default: 0
  },
  phone: {
    type: String,
    trim: true,
    match: /^[0-9\s+()-]{7,20}$/, // Validación simple
    default: ""
  },
  showPhone: {
    type: Boolean,
    default: true // Permite ocultar el teléfono si quiere
  },
  averageRating: {
    type: Number,
    default: 0
  },
}, {
  timestamps: true
});

const ProfessionalModel = mongoose.model("Professional", professionalSchema);
professionalSchema.index({ location: '2dsphere' }); // 🟩 Indice para búsqueda geoespaciales
export default ProfessionalModel;
