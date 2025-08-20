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
  }, // ⬇️ NUEVO: dirección “humana”
  address: {
    country: { type: String, default: "" },     // País
    state:   { type: String, default: "" },     // Provincia/Estado
    city:    { type: String, default: "" },     // Ciudad / Localidad
    street:  { type: String, default: "" },     // Calle
    number:  { type: String, default: "" },     // Número
    unit:    { type: String, default: "" },     // Depto/Oficina/Casa
    postalCode: { type: String, default: "" },  // Código postal
  // (dejá tu location GeoJSON como está, no lo tocamos)
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
    default: 0,
    min: 0,
    max: 5
  },
  availabilityStrategy: {
    type: String,
    enum: ["manual", "schedule"],
    default: "manual"
  },  
  avatarUrl: { type: String, default: "" },
  documents: {
    criminalRecordUrl: { type: String, default: "" }, // antecedentes (opcional)
    credentialUrl:    { type: String, default: "" }, // título / matrícula (opcional)
  },
}, {
  timestamps: true
});

const ProfessionalModel = mongoose.model("Professional", professionalSchema);
professionalSchema.index({ location: '2dsphere' }); // 🟩 Indice para búsqueda geoespaciales
export default ProfessionalModel;


