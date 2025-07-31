// src/seed/seedServicesAndCategories.js

import mongoose from "mongoose";
import dotenv from "dotenv";

// Modelos
import ServiceModel from "../models/Service.js";
import CategoryModel from "../models/Category.js";

// Utils
import { slugify } from "../utils/slugify.js";
import { capitalizeWords } from "../utils/capitalizeWords.js";

// Config
dotenv.config();

// Categorías con slug generado
const categories = [
  { name: "Salud" },
  { name: "Belleza" },
  { name: "Bienestar" },
  { name: "Electricidad" },
  { name: "Plomería" },
  { name: "Gas" },
  { name: "Albañilería" },
  { name: "Carpintería" },
  { name: "Tecnología" },
  { name: "Limpieza" },
  { name: "Niñera" },
  { name: "Cuidado de adultos mayores" },
  { name: "Psicología" },
  { name: "Coaching" },
  { name: "Nutrición" },
  { name: "Veterinaria" },
  { name: "Peluquería" },
  { name: "Depilación" },
  { name: "Uñas" },
  { name: "Diseño gráfico" },
  { name: "Fotografía" },
  { name: "Marketing" },
  { name: "Contabilidad" },
  { name: "Asesoría legal" },
  { name: "Mecánica" },
].map(cat => ({
  name: capitalizeWords(cat.name),
  slug: slugify(cat.name)
}));

// Servicios (sin slug, se generan automáticamente en modelo)
const services = [
  // mismos servicios que ya tenías…
  { name: "Instalación eléctrica", description: "Instalaciones completas para hogares", price: 10000, categoryName: "Electricidad" },
  { name: "Reparación de enchufes", description: "Solución de cortocircuitos y enchufes quemados", price: 2500, categoryName: "Electricidad" },
  { name: "Reparación de caños", description: "Solución a fugas de agua y caños rotos", price: 3000, categoryName: "Plomería" },
  { name: "Destapación de cloacas", description: "Servicio urgente o programado", price: 4500, categoryName: "Plomería" },
  { name: "Instalación de gas", description: "Habilitado para trabajar con redes de gas", price: 12000, categoryName: "Gas" },
  { name: "Colocación de cerámicos", description: "Pisos y paredes", price: 7000, categoryName: "Albañilería" },
  { name: "Armado de muebles", description: "Armado de muebles a medida", price: 5000, categoryName: "Carpintería" },
  { name: "Limpieza profunda de hogar", description: "Desinfección completa", price: 6000, categoryName: "Limpieza" },
  { name: "Corte de cabello", description: "Cabello corto, largo, con estilo", price: 2000, categoryName: "Peluquería" },
  { name: "Depilación definitiva", description: "Depilación láser", price: 8000, categoryName: "Depilación" },
  { name: "Uñas esculpidas", description: "Diseño y esmaltado", price: 3500, categoryName: "Uñas" },
  { name: "Masaje relajante", description: "Terapia descontracturante", price: 4000, categoryName: "Bienestar" },
  { name: "Psicoterapia individual", description: "Consulta online o presencial", price: 6000, categoryName: "Psicología" },
  { name: "Coaching personal", description: "Sesiones motivacionales", price: 5000, categoryName: "Coaching" },
  { name: "Consulta nutricional", description: "Planes alimenticios personalizados", price: 4500, categoryName: "Nutrición" },
  { name: "Vacunación de mascotas", description: "Perros y gatos", price: 2500, categoryName: "Veterinaria" },
  { name: "Cuidado de niños por hora", description: "Con experiencia y referencias", price: 2000, categoryName: "Niñera" },
  { name: "Acompañamiento de mayores", description: "Día o noche", price: 3500, categoryName: "Cuidado de adultos mayores" },
  { name: "Reparación de PC", description: "Formateo, limpieza, cambio de partes", price: 4500, categoryName: "Tecnología" },
  { name: "Sesión de fotos profesional", description: "Book personal o eventos", price: 10000, categoryName: "Fotografía" },
  { name: "Publicidad en redes sociales", description: "Campañas pagas y contenido", price: 9000, categoryName: "Marketing" },
  { name: "Declaración de impuestos", description: "Monotributo y autónomos", price: 8000, categoryName: "Contabilidad" },
  { name: "Consulta legal", description: "Civil, comercial o laboral", price: 7000, categoryName: "Asesoría legal" },
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("📦 Conectado a MongoDB");

    await CategoryModel.deleteMany();
    await ServiceModel.deleteMany();
    console.log("🧹 Datos antiguos eliminados");

    const insertedCategories = await CategoryModel.insertMany(categories);
    console.log("📚 Categorías insertadas:", insertedCategories.length);

    const categoryMap = {};
    insertedCategories.forEach(cat => {
      categoryMap[cat.slug] = cat._id;
    });
    
    // Asignamos ID real a cada servicio usando slug
    const servicesWithCategoryId = services.map(service => {
      const categorySlug = slugify(service.categoryName);
      const categoryId = categoryMap[categorySlug];
    
      if (!categoryId) {
        throw new Error(`❌ No se encontró la categoría para el servicio: "${service.name}" (${service.categoryName})`);
      }
    
      return {
        ...service,
        name: capitalizeWords(service.name),
        slug: slugify(service.name),
        category: categoryId
      };
    });
    
    const insertedServices = await ServiceModel.insertMany(servicesWithCategoryId);
    console.log("🛠️ Servicios insertados:", insertedServices.length);

    await mongoose.connection.close();
    console.log("✅ Seed completado y conexión cerrada");
  } catch (error) {
    console.error("❌ Error en el seed:", error);
    process.exit(1);
  }
};

seedDB();
