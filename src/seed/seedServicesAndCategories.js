// src/seed/seedServicesAndCategories.js

/**
 * SUINFI – Seed de Categorías y Servicios (versión jerárquica plana, limpia)
 *
 * Cambios:
 * - [CAMBIO MAYOR] Se elimina la generación de "tareas por subcategoría". Ahora solo guardamos OFICIOS/ROLES.
 * - [CAMBIO] Se elimina la familia "Desarrollo de software · …". Queda un solo servicio "Desarrollo de software"
 *            bajo "Ingenierías · Sistemas", como pediste.
 * - [CAMBIO] Se crea `__servicesByCategory` con oficios por categoría (ampliado y sin duplicados por género en ingeniería).
 * - [LIMPIEZA] Se quitan servicios-tarea heredados y prefijos "OFICIO - TAREA".
 * - [SIN CAMBIOS] Modelos, conexión y `seedDB` intactos.
 */

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

// -----------------------------------------------------------------------------
// Categorías con slug generado (AMPLIAS, AR + generales)
// **Respeta el nombre exacto de tu constante: `categories`**
// -----------------------------------------------------------------------------
// [CAMBIO] Se mantiene la jerarquía madre · subcategoría, pero se elimina la familia
// "Desarrollo de software · ..." (ver comentario más abajo). Todo el resto igual o ampliado.
const categories = [
  // =========================
  // HOGAR Y MANTENIMIENTO
  // =========================
  { name: "Hogar y mantenimiento · Electricidad" },
  { name: "Hogar y mantenimiento · Plomería" },
  { name: "Hogar y mantenimiento · Gas" },
  { name: "Hogar y mantenimiento · Albañilería" },
  { name: "Hogar y mantenimiento · Carpintería" },
  { name: "Hogar y mantenimiento · Herrería" },
  { name: "Hogar y mantenimiento · Cerrajería" },
  { name: "Hogar y mantenimiento · Pintura" },
  { name: "Hogar y mantenimiento · Construcción en seco" },
  { name: "Hogar y mantenimiento · Impermeabilización" },
  { name: "Hogar y mantenimiento · Jardinería" },
  { name: "Hogar y mantenimiento · Parquización" },
  { name: "Hogar y mantenimiento · Riego automático" },
  { name: "Hogar y mantenimiento · Piscinas" },
  { name: "Hogar y mantenimiento · Control de plagas" },
  { name: "Hogar y mantenimiento · Limpieza" },
  { name: "Hogar y mantenimiento · Aire acondicionado" },
  { name: "Hogar y mantenimiento · Calefacción" },
  { name: "Hogar y mantenimiento · Electrodomésticos" },
  { name: "Hogar y mantenimiento · Vidriería" },
  { name: "Hogar y mantenimiento · Techos y zinguería" },
  { name: "Hogar y mantenimiento · Yesería" },
  { name: "Hogar y mantenimiento · Persianas y cortinas" },
  { name: "Hogar y mantenimiento · Pisos y revestimientos" },
  { name: "Hogar y mantenimiento · Domótica" },
  { name: "Hogar y mantenimiento · Energía solar" },
  { name: "Hogar y mantenimiento · Seguridad (CCTV y alarmas)" },
  { name: "Hogar y mantenimiento · Mudanzas y fletes" },
  { name: "Hogar y mantenimiento · Tapicería" },

  // =========================
  // TECNOLOGÍA Y SOPORTE
  // =========================
  { name: "Tecnología y soporte · Soporte técnico y Telefonía" },
  { name: "Tecnología y soporte · Redes y Telecomunicaciones" },
  { name: "Tecnología y soporte · Automatización e IoT" },

  // =========================
  // INGENIERÍA DE DATOS (se mantiene como familia)
  // =========================
  { name: "Ingeniería de datos · Data Engineering" },
  { name: "Ingeniería de datos · Data Analytics y BI" },
  { name: "Ingeniería de datos · Data Science" },
  { name: "Ingeniería de datos · MLOps" },
  { name: "Ingeniería de datos · Gobernanza de datos" },

  // =========================
  // SEGURIDAD INFORMÁTICA
  // =========================
  { name: "Seguridad informática · Blue Team" },
  { name: "Seguridad informática · Red Team" },
  { name: "Seguridad informática · GRC y Compliance" },

  // =========================
  // INGENIERÍAS (familia clásica)
  // =========================
  { name: "Ingenierías · Civil" },
  { name: "Ingenierías · Industrial" },
  { name: "Ingenierías · Química" },
  { name: "Ingenierías · Mecánica" },
  { name: "Ingenierías · Eléctrica" },
  { name: "Ingenierías · Electrónica" },
  { name: "Ingenierías · Sistemas" }, // [CAMBIO] Aquí colgamos "Desarrollo de software" como un único servicio
  { name: "Ingenierías · Ambiental" },
  { name: "Ingenierías · Higiene y Seguridad" },
  { name: "Ingenierías · Agronómica" },
  { name: "Ingenierías · Biomédica" },
  { name: "Ingenierías · Telecomunicaciones" },

  // =========================
  // AUTOMOTOR
  // =========================
  { name: "Automotor · Mecánica" },
  { name: "Automotor · Electricidad del automotor" },
  { name: "Automotor · Chapa y pintura" },
  { name: "Automotor · Gomería" },
  { name: "Automotor · Detailing" },
  { name: "Automotor · Lavado de autos" },
  { name: "Automotor · Auxilio mecánico" },
  { name: "Automotor · Audio y multimedia" },
  { name: "Automotor · Aire acondicionado automotor" },
  { name: "Automotor · Tapizado automotor" },

  // =========================
  // PROFESIONALES Y NEGOCIOS
  // =========================
  { name: "Profesionales y negocios · Contabilidad" },
  { name: "Profesionales y negocios · Asesoría legal" },
  { name: "Profesionales y negocios · Recursos humanos" },
  { name: "Profesionales y negocios · Marketing" },
  { name: "Profesionales y negocios · Diseño gráfico" },
  { name: "Profesionales y negocios · Redacción y copywriting" },
  { name: "Profesionales y negocios · Traducción" },
  { name: "Profesionales y negocios · Arquitectura" },
  { name: "Profesionales y negocios · Agrimensura" },
  { name: "Profesionales y negocios · Inmobiliaria" },
  { name: "Profesionales y negocios · Seguridad e higiene" },
  { name: "Profesionales y negocios · Producción audiovisual" },
  { name: "Profesionales y negocios · Impresión y gráfica" },
  { name: "Profesionales y negocios · Community management" },
  { name: "Profesionales y negocios · Fotografía" },
  { name: "Profesionales y negocios · Filmación" },
  { name: "Profesionales y negocios · Gestoría y trámites" },
  { name: "Profesionales y negocios · Ventas y comercio" },
  { name: "Profesionales y negocios · Administración de consorcios" },
  { name: "Profesionales y negocios · Finanzas e inversiones" },
  { name: "Profesionales y negocios · Seguridad privada" },

  // =========================
  // SALUD / BIENESTAR / BELLEZA
  // =========================
  { name: "Salud y bienestar · Salud" },
  { name: "Salud y bienestar · Psicología" },
  { name: "Salud y bienestar · Nutrición" },
  { name: "Salud y bienestar · Kinesiología" },
  { name: "Salud y bienestar · Fonoaudiología" },
  { name: "Salud y bienestar · Odontología" },
  { name: "Salud y bienestar · Enfermería" },
  { name: "Salud y bienestar · Bienestar" },
  { name: "Salud y bienestar · Peluquería" },
  { name: "Salud y bienestar · Barbería" },
  { name: "Salud y bienestar · Maquillaje" },
  { name: "Salud y bienestar · Depilación" },
  { name: "Salud y bienestar · Uñas" },
  { name: "Salud y bienestar · Cosmetología" },
  { name: "Salud y bienestar · Masajes" },
  { name: "Salud y bienestar · Spa" },
  { name: "Salud y bienestar · Entrenamiento personal" },
  { name: "Salud y bienestar · Podología" },
  { name: "Salud y bienestar · Estética" },

  // =========================
  // EDUCACIÓN / CAPACITACIÓN
  // =========================
  { name: "Educación · Docente primaria" },
  { name: "Educación · Docente secundaria" },
  { name: "Educación · Docente universitaria" },
  { name: "Educación · Clases particulares" },
  { name: "Educación · Idiomas" },
  { name: "Educación · Música" },
  { name: "Educación · Programación" },
  { name: "Educación · Apoyo escolar" },
  { name: "Educación · Psicopedagogía" },
  { name: "Educación · Educación especial" },
  { name: "Educación · Orientación vocacional" },
  { name: "Educación · Danza y baile" },
  { name: "Educación · Deportes por disciplina" },

  // =========================
  // CUIDADO
  // =========================
  { name: "Cuidado · Niñera" },
  { name: "Cuidado · Cuidado de adultos mayores" },
  { name: "Cuidado · Acompañante terapéutico" },

  // =========================
  // MASCOTAS
  // =========================
  { name: "Mascotas · Veterinaria" },
  { name: "Mascotas · Paseo de perros" },
  { name: "Mascotas · Peluquería canina" },
  { name: "Mascotas · Adiestramiento canino" },
  { name: "Mascotas · Cuidado de mascotas" },
  { name: "Mascotas · Guardería canina" },

  // =========================
  // EVENTOS / GASTRONOMÍA
  // =========================
  { name: "Eventos y gastronomía · Organización de eventos" },
  { name: "Eventos y gastronomía · Mozos y camareras" },
  { name: "Eventos y gastronomía · Bartenders" },
  { name: "Eventos y gastronomía · DJs" },
  { name: "Eventos y gastronomía · Sonido e iluminación" },
  { name: "Eventos y gastronomía · Decoración de eventos" },
  { name: "Eventos y gastronomía · Alquiler de livings" },
  { name: "Eventos y gastronomía · Catering" },
  { name: "Eventos y gastronomía · Chefs a domicilio" },
  { name: "Eventos y gastronomía · Pastelería" },
  { name: "Eventos y gastronomía · Food trucks" },
  { name: "Eventos y gastronomía · Seguridad para eventos" },
  { name: "Eventos y gastronomía · Animación infantil" },
  { name: "Eventos y gastronomía · Wedding planner" },
  { name: "Eventos y gastronomía · Cafetería y barismo" },
  { name: "Eventos y gastronomía · Bacheros y limpieza de cocina" },
  { name: "Eventos y gastronomía · Música en vivo y shows" },

  // =========================
  // LOGÍSTICA / TRANSPORTE
  // =========================
  { name: "Logística y transporte · Mensajería y cadetería" },
  { name: "Logística y transporte · Envíos y paquetería" },
  { name: "Logística y transporte · Courier internacional" },
  { name: "Logística y transporte · Fletes" },
  { name: "Logística y transporte · Mudanzas" },
  { name: "Logística y transporte · Traslados y chofer" },
  { name: "Logística y transporte · Cargas pesadas" },

  // =========================
  // INDUSTRIAL / AGRO
  // =========================
  { name: "Industrial y agro · Soldadura industrial" },
  { name: "Industrial y agro · Tornería y fresado" },
  { name: "Industrial y agro · Electricidad industrial" },
  { name: "Industrial y agro · Montajes industriales" },
  { name: "Industrial y agro · Refrigeración industrial" },
  { name: "Industrial y agro · Seguridad industrial" },
  { name: "Industrial y agro · Agricultura" },
  { name: "Industrial y agro · Riego agrícola" },
  { name: "Industrial y agro · Maquinaria agrícola" },
  { name: "Industrial y agro · Minería y perforaciones" },

  // =========================
  // TURISMO / OCIO
  // =========================
  { name: "Turismo y ocio · Guía turístico" },
  { name: "Turismo y ocio · Traslados aeropuerto" },
  { name: "Turismo y ocio · Alquiler de vehículos" },
  { name: "Turismo y ocio · Organización de viajes" },

  // =========================
  // ARTE / MANUALIDADES
  // =========================
  { name: "Arte y manualidades · Arte y pintura" },
  { name: "Arte y manualidades · Cerámica" },
  { name: "Arte y manualidades · Manualidades" },
  { name: "Arte y manualidades · Carpintería artística" },

  // =========================
  // COMERCIOS LOCALES (AMPLIADO)
  // =========================
  { name: "Comercios locales · Kiosco" },
  { name: "Comercios locales · Minimercado" },
  { name: "Comercios locales · Almacén" },
  { name: "Comercios locales · Verdulería" },
  { name: "Comercios locales · Carnicería" },
  { name: "Comercios locales · Panadería" },
  { name: "Comercios locales · Rotisería" },
  { name: "Comercios locales · Pastas frescas" },
  { name: "Comercios locales · Pollería" },
  { name: "Comercios locales · Pescadería" },
  { name: "Comercios locales · Fiambrería" },
  { name: "Comercios locales · Ferretería" },
  { name: "Comercios locales · Pinturería" },
  { name: "Comercios locales · Librería y copiado" },
  { name: "Comercios locales · Papelería" },
  { name: "Comercios locales · Farmacia" },
  { name: "Comercios locales · Perfumería" },
  { name: "Comercios locales · Pet shop" },
  { name: "Comercios locales · Lavandería" },
  { name: "Comercios locales · Tintorería" },
  { name: "Comercios locales · Cervecería artesanal" },
  { name: "Comercios locales · Heladería" },
  { name: "Comercios locales · Vinoteca" },
  { name: "Comercios locales · Artículos de limpieza" },
  { name: "Comercios locales · Bazar y regalería" },
  { name: "Comercios locales · Mueblería" },
  { name: "Comercios locales · Bicicletería" },

  // =========================
  // SERVICIOS FUNERARIOS
  // =========================
  { name: "Servicios funerarios · Cementerio y sepelios" },

  // Catch-all
  { name: "Otras profesiones" },
].map((cat) => ({
  name: capitalizeWords(cat.name),
  slug: slugify(cat.name),
}));

// -----------------------------------------------------------------------------
// [CAMBIO MAYOR] Solo OFICIOS/ROLES por categoría (sin tareas).
// `__servicesByCategory` reemplaza a cualquier mapeo de "tareas" y a los alias prefijados.
// -----------------------------------------------------------------------------
const __servicesByCategory = {
  // =========================
  // HOGAR Y MANTENIMIENTO
  // =========================
  "Hogar y mantenimiento · Electricidad": ["Electricista", "Instalador eléctrico"],
  "Hogar y mantenimiento · Plomería": ["Plomero", "Sanitario"],
  "Hogar y mantenimiento · Gas": ["Gasista", "Gasista matriculado"],
  "Hogar y mantenimiento · Albañilería": ["Albañil", "Maestro mayor de obras"],
  "Hogar y mantenimiento · Carpintería": ["Carpintero"],
  "Hogar y mantenimiento · Herrería": ["Herrero"],
  "Hogar y mantenimiento · Cerrajería": ["Cerrajero"],
  "Hogar y mantenimiento · Pintura": ["Pintor"],
  "Hogar y mantenimiento · Construcción en seco": ["Instalador de durlock"],
  "Hogar y mantenimiento · Impermeabilización": ["Impermeabilizador"],
  "Hogar y mantenimiento · Jardinería": ["Jardinero"],
  "Hogar y mantenimiento · Parquización": ["Parquizador"],
  "Hogar y mantenimiento · Riego automático": ["Instalador de riego"],
  "Hogar y mantenimiento · Piscinas": ["Piscinero"],
  "Hogar y mantenimiento · Control de plagas": ["Control de plagas"],
  "Hogar y mantenimiento · Limpieza": ["Personal de limpieza"],
  "Hogar y mantenimiento · Aire acondicionado": ["Técnico de aire acondicionado"],
  "Hogar y mantenimiento · Calefacción": ["Calefaccionista"],
  "Hogar y mantenimiento · Electrodomésticos": ["Técnico en electrodomésticos"],
  "Hogar y mantenimiento · Vidriería": ["Vidriero"],
  "Hogar y mantenimiento · Techos y zinguería": ["Techista", "Zinguero"],
  "Hogar y mantenimiento · Yesería": ["Yesero"],
  "Hogar y mantenimiento · Persianas y cortinas": ["Persianero", "Colocador de cortinas"],
  "Hogar y mantenimiento · Pisos y revestimientos": ["Colocador de pisos"],
  "Hogar y mantenimiento · Domótica": ["Integrador smart home"],
  "Hogar y mantenimiento · Energía solar": ["Instalador fotovoltaico"],
  "Hogar y mantenimiento · Seguridad (CCTV y alarmas)": ["Instalador de cámaras", "Técnico de alarmas"],
  "Hogar y mantenimiento · Mudanzas y fletes": ["Fletero", "Mudanzas"],
  "Hogar y mantenimiento · Tapicería": ["Tapicero"],

  // =========================
  // TECNOLOGÍA Y SOPORTE
  // =========================
  "Tecnología y soporte · Soporte técnico y Telefonía": ["Técnico PC", "Técnico smartphones", "Técnico telefonía"],
  "Tecnología y soporte · Redes y Telecomunicaciones": ["Técnico redes", "Cableador estructurado"],
  "Tecnología y soporte · Automatización e IoT": ["Técnico automatización", "Integrador IoT"],

  // =========================
  // INGENIERÍA DE DATOS
  // =========================
  "Ingeniería de datos · Data Engineering": ["Data engineer"],
  "Ingeniería de datos · Data Analytics y BI": ["Data analyst"],
  "Ingeniería de datos · Data Science": ["Data scientist"],
  "Ingeniería de datos · MLOps": ["MLOps engineer"],
  "Ingeniería de datos · Gobernanza de datos": ["Data governance"],

  // =========================
  // SEGURIDAD INFORMÁTICA
  // =========================
  "Seguridad informática · Blue Team": ["Analista blue team"],
  "Seguridad informática · Red Team": ["Pentester"],
  "Seguridad informática · GRC y Compliance": ["Consultor GRC"],

  // =========================
  // INGENIERÍAS (clásicas)
  // =========================
  // [CAMBIO] Evito duplicados por género: uso un solo canónico por área.
  "Ingenierías · Civil": ["Ingeniero civil"],
  "Ingenierías · Industrial": ["Ingeniero industrial"],
  "Ingenierías · Química": ["Ingeniero químico"],
  "Ingenierías · Mecánica": ["Ingeniero mecánico"],
  "Ingenierías · Eléctrica": ["Ingeniero electricista"],
  "Ingenierías · Electrónica": ["Ingeniero electrónico"],
  "Ingenierías · Sistemas": [
    "Ingeniero en sistemas",
    // [CAMBIO] Pedido: SOLO dejar "Desarrollo de software" aquí.
    "Desarrollo de software",
  ],
  "Ingenierías · Ambiental": ["Ingeniero ambiental"],
  "Ingenierías · Higiene y Seguridad": ["Ingeniero en higiene y seguridad"],
  "Ingenierías · Agronómica": ["Ingeniero agrónomo"],
  "Ingenierías · Biomédica": ["Ingeniero biomédico"],
  "Ingenierías · Telecomunicaciones": ["Ingeniero en telecomunicaciones"],

  // =========================
  // AUTOMOTOR
  // =========================
  "Automotor · Mecánica": ["Mecánico automotor"],
  "Automotor · Electricidad del automotor": ["Electricista del automotor"],
  "Automotor · Chapa y pintura": ["Chapista", "Pintor automotor"],
  "Automotor · Gomería": ["Gomero"],
  "Automotor · Detailing": ["Detailer"],
  "Automotor · Lavado de autos": ["Lavadero", "Lavacoches"],
  "Automotor · Auxilio mecánico": ["Auxilio mecánico"],
  "Automotor · Audio y multimedia": ["Instalador car audio"],
  "Automotor · Aire acondicionado automotor": ["Técnico aire acondicionado automotor"],
  "Automotor · Tapizado automotor": ["Tapicero automotor"],

  // =========================
  // PROFESIONALES Y NEGOCIOS
  // =========================
  "Profesionales y negocios · Contabilidad": ["Contador"],
  "Profesionales y negocios · Asesoría legal": ["Abogado"],
  "Profesionales y negocios · Recursos humanos": ["Analista RRHH", "Selector"],
  "Profesionales y negocios · Marketing": ["Especialista marketing", "Vendedor e-commerce"],
  "Profesionales y negocios · Diseño gráfico": ["Diseñador gráfico"],
  "Profesionales y negocios · Redacción y copywriting": ["Copywriter", "Redactor"],
  "Profesionales y negocios · Traducción": ["Traductor"],
  "Profesionales y negocios · Arquitectura": ["Arquitecto"],
  "Profesionales y negocios · Agrimensura": ["Agrimensor"],
  "Profesionales y negocios · Inmobiliaria": ["Martillero / Corredor inmobiliario"],
  "Profesionales y negocios · Seguridad e higiene": ["Técnico en seguridad e higiene"],
  "Profesionales y negocios · Producción audiovisual": ["Productor audiovisual", "Editor de video"],
  "Profesionales y negocios · Impresión y gráfica": ["Gráfico / impresiones"],
  "Profesionales y negocios · Community management": ["Community manager"],
  "Profesionales y negocios · Fotografía": ["Fotógrafo"],
  "Profesionales y negocios · Filmación": ["Camarógrafo"],
  "Profesionales y negocios · Gestoría y trámites": ["Gestor de trámites"],
  "Profesionales y negocios · Ventas y comercio": [
    "Vendedor",
    "Cajero",
    "Repositor",
    "Merchandiser",
    "Atención al cliente",
    "Telemarketer",
    "Preventista",
  ],
  "Profesionales y negocios · Administración de consorcios": ["Administrador de consorcios"],
  "Profesionales y negocios · Finanzas e inversiones": ["Asesor financiero"],
  "Profesionales y negocios · Seguridad privada": ["Vigilador privado", "Control de accesos"],

  // =========================
  // SALUD / BIENESTAR / BELLEZA
  // =========================
  "Salud y bienestar · Salud": ["Médico clínico"],
  "Salud y bienestar · Psicología": ["Psicólogo"],
  "Salud y bienestar · Nutrición": ["Nutricionista"],
  "Salud y bienestar · Kinesiología": ["Kinesiólogo"],
  "Salud y bienestar · Fonoaudiología": ["Fonoaudiólogo"],
  "Salud y bienestar · Odontología": ["Odontólogo"],
  "Salud y bienestar · Enfermería": ["Enfermero"],
  "Salud y bienestar · Bienestar": ["Instructor de bienestar"],
  "Salud y bienestar · Peluquería": ["Peluquero"],
  "Salud y bienestar · Barbería": ["Barbero"],
  "Salud y bienestar · Maquillaje": ["Maquillador"],
  "Salud y bienestar · Depilación": ["Depilador"],
  "Salud y bienestar · Uñas": ["Manicurista", "Nail artist"],
  "Salud y bienestar · Cosmetología": ["Cosmetólogo", "Esteticista"],
  "Salud y bienestar · Masajes": ["Masajista"],
  "Salud y bienestar · Spa": ["Spa (operador)"],
  "Salud y bienestar · Entrenamiento personal": ["Entrenador personal"],
  "Salud y bienestar · Podología": ["Podólogo"],
  "Salud y bienestar · Estética": ["Esteticista"],

  // =========================
  // EDUCACIÓN / CAPACITACIÓN
  // =========================
  "Educación · Docente primaria": ["Docente primaria"],
  "Educación · Docente secundaria": ["Docente secundaria"],
  "Educación · Docente universitaria": ["Docente universitaria"],
  "Educación · Clases particulares": ["Profesor particular"],
  "Educación · Idiomas": ["Profesor de idiomas"],
  "Educación · Música": ["Profesor de música"],
  "Educación · Programación": ["Instructor de programación"],
  "Educación · Apoyo escolar": ["Tutor académico"],
  "Educación · Psicopedagogía": ["Psicopedagogo"],
  "Educación · Educación especial": ["Docente educación especial"],
  "Educación · Orientación vocacional": ["Orientador vocacional"],
  "Educación · Danza y baile": ["Profesor de baile"],
  // [CAMBIO] "Entrenador de (deporte)" directo (no como sublista de tareas).
  "Educación · Deportes por disciplina": [
    "Entrenador de fútbol",
    "Entrenador de básquet",
    "Entrenador de voley",
    "Entrenador de tenis",
    "Entrenador de pádel",
    "Entrenador de hockey",
    "Entrenador de natación",
    "Entrenador de atletismo",
    "Entrenador de artes marciales",
    "Entrenador de boxeo",
    "Entrenador de ciclismo",
    "Entrenador de rugby",
    "Entrenador de handball",
    "Entrenador de skate",
    "Entrenador de gimnasia",
    "Preparador físico",
  ],

  // =========================
  // CUIDADO
  // =========================
  "Cuidado · Niñera": ["Niñera"],
  "Cuidado · Cuidado de adultos mayores": ["Cuidador de adultos mayores"],
  "Cuidado · Acompañante terapéutico": ["Acompañante terapéutico"],

  // =========================
  // MASCOTAS
  // =========================
  "Mascotas · Veterinaria": ["Veterinario"],
  "Mascotas · Paseo de perros": ["Paseador de perros"],
  "Mascotas · Peluquería canina": ["Peluquero canino"],
  "Mascotas · Adiestramiento canino": ["Adiestrador canino"],
  "Mascotas · Cuidado de mascotas": ["Petsitter"],
  "Mascotas · Guardería canina": ["Guardería canina"],

  // =========================
  // EVENTOS / GASTRONOMÍA  (esto estaba OK según tu feedback)
  // =========================
  "Eventos y gastronomía · Organización de eventos": ["Organizador de eventos", "Coordinador de eventos"],
  "Eventos y gastronomía · Mozos y camareras": ["Mozo", "Camarero", "Camarera"],
  "Eventos y gastronomía · Bartenders": ["Bartender"],
  "Eventos y gastronomía · DJs": ["DJ"],
  "Eventos y gastronomía · Sonido e iluminación": ["Sonidista", "Iluminador"],
  "Eventos y gastronomía · Decoración de eventos": ["Decorador de eventos", "Ambientador"],
  "Eventos y gastronomía · Alquiler de livings": ["Alquiler de livings"],
  "Eventos y gastronomía · Catering": [
    "Cocinero",
    "Cocinera",
    "Ayudante de cocina",
    "Parrillero",
    "Pizzero",
    "Pastelero",
    "Panadero",
    "Rotisero",
    "Heladero",
    "Sandwichero",
    "Sushiman",
    "Maestro pizzero",
    "Repostero",
  ],
  "Eventos y gastronomía · Chefs a domicilio": ["Chef", "Chef a domicilio"],
  "Eventos y gastronomía · Pastelería": ["Pastelero"],
  "Eventos y gastronomía · Food trucks": ["Food truck"],
  "Eventos y gastronomía · Seguridad para eventos": ["Seguridad para eventos"],
  "Eventos y gastronomía · Animación infantil": ["Animador infantil"],
  "Eventos y gastronomía · Wedding planner": ["Wedding planner"],
  "Eventos y gastronomía · Cafetería y barismo": ["Barista"],
  "Eventos y gastronomía · Bacheros y limpieza de cocina": ["Bachero", "Bacha"],
  "Eventos y gastronomía · Música en vivo y shows": ["Músico", "Banda", "Cantante", "Dúo acústico"],

  // =========================
  // LOGÍSTICA / TRANSPORTE
  // =========================
  "Logística y transporte · Mensajería y cadetería": ["Mensajero", "Cadete"],
  "Logística y transporte · Envíos y paquetería": ["Paquetería"],
  "Logística y transporte · Courier internacional": ["Courier internacional"],
  "Logística y transporte · Fletes": ["Fletero"],
  "Logística y transporte · Mudanzas": ["Mudanzas"],
  "Logística y transporte · Traslados y chofer": [
    "Chofer particular",
    "Chofer de camión",
    "Chofer de colectivo",
    "Chofer de grúa",
    "Remisero",
    "Taxista",
    "Autoelevadorista",
  ],
  "Logística y transporte · Cargas pesadas": ["Operador de grúa", "Grúista"],

  // =========================
  // INDUSTRIAL / AGRO
  // =========================
  "Industrial y agro · Soldadura industrial": ["Soldador", "Calderero"],
  "Industrial y agro · Tornería y fresado": ["Tornero", "Fresador", "Matricero"],
  "Industrial y agro · Electricidad industrial": ["Electricista industrial", "Instrumentista"],
  "Industrial y agro · Montajes industriales": ["Montajista", "Rigger"],
  "Industrial y agro · Refrigeración industrial": ["Técnico refrigeración industrial"],
  "Industrial y agro · Seguridad industrial": ["Técnico seguridad industrial"],
  "Industrial y agro · Agricultura": ["Capataz", "Viñatero", "Enólogo", "Bodeguero", "Vendimiador"],
  "Industrial y agro · Riego agrícola": ["Técnico riego agrícola"],
  "Industrial y agro · Maquinaria agrícola": ["Tractorista", "Maquinista agrícola", "Pulverizadorista"],
  "Industrial y agro · Minería y perforaciones": [
    "Perforista",
    "Operador de jumbo",
    "Operador de perforadora",
    "Operador de retroexcavadora",
    "Motonivelador",
    "Topadorista",
    "Operador de pala cargadora",
    "Operador de dumper",
    "Operador de compresor",
    "Ayudante minero",
    "Tirotero",
  ],

  // =========================
  // TURISMO / OCIO
  // =========================
  "Turismo y ocio · Guía turístico": ["Guía de turismo"],
  "Turismo y ocio · Traslados aeropuerto": ["Transferista"],
  "Turismo y ocio · Alquiler de vehículos": ["Alquiler de vehículos"],
  "Turismo y ocio · Organización de viajes": ["Organizador de viajes"],

  // =========================
  // ARTE / MANUALIDADES
  // =========================
  "Arte y manualidades · Arte y pintura": ["Artista", "Pintor mural"],
  "Arte y manualidades · Cerámica": ["Ceramista"],
  "Arte y manualidades · Manualidades": ["Artesano"],
  "Arte y manualidades · Carpintería artística": ["Carpintero artístico"],

  // =========================
  // COMERCIOS LOCALES
  // =========================
  "Comercios locales · Kiosco": ["Kiosquero"],
  "Comercios locales · Minimercado": ["Minimercado"],
  "Comercios locales · Almacén": ["Almacenero"],
  "Comercios locales · Verdulería": ["Verdulero"],
  "Comercios locales · Carnicería": ["Carnicero"],
  "Comercios locales · Panadería": ["Panadero"],
  "Comercios locales · Rotisería": ["Rotisero"],
  "Comercios locales · Pastas frescas": ["Fideero / pastas frescas"],
  "Comercios locales · Pollería": ["Pollero"],
  "Comercios locales · Pescadería": ["Pescadero"],
  "Comercios locales · Fiambrería": ["Fiambrero"],
  "Comercios locales · Ferretería": ["Ferretero"],
  "Comercios locales · Pinturería": ["Pinturero"],
  "Comercios locales · Librería y copiado": ["Librero"],
  "Comercios locales · Papelería": ["Papelería"],
  "Comercios locales · Farmacia": ["Farmacéutico"],
  "Comercios locales · Perfumería": ["Perfumería"],
  "Comercios locales · Pet shop": ["Pet shop"],
  "Comercios locales · Lavandería": ["Lavandería"],
  "Comercios locales · Tintorería": ["Tintorería"],
  "Comercios locales · Cervecería artesanal": ["Cervecero artesanal"],
  "Comercios locales · Heladería": ["Heladero"],
  "Comercios locales · Vinoteca": ["Vinoteca"],
  "Comercios locales · Artículos de limpieza": ["Artículos de limpieza"],
  "Comercios locales · Bazar y regalería": ["Bazar y regalería"],
  "Comercios locales · Mueblería": ["Mueblero"],
  "Comercios locales · Bicicletería": ["Bicicletero"],

  // =========================
  // SERVICIOS FUNERARIOS
  // =========================
  "Servicios funerarios · Cementerio y sepelios": ["Sepulturero", "Servicios de sepelio"],

  // Catch-all
  "Otras profesiones": ["Profesional independiente"],
};

// -----------------------------------------------------------------------------
// Construcción de `services` SOLO con OFICIOS (sin tareas) + extras educativos.
// [CAMBIO] Se elimina todo lo que generaba subtareas o prefijos "OFICIO - TAREA".
// -----------------------------------------------------------------------------
const __primary = ["Lengua", "Matemática", "Ciencias naturales", "Ciencias sociales", "Inglés básico"];
const __secondary = [
  "Matemática",
  "Física",
  "Química",
  "Biología",
  "Historia",
  "Geografía",
  "Lengua y literatura",
  "Filosofía",
  "Economía",
  "Informática",
];
const __university = [
  "Análisis matemático",
  "Álgebra",
  "Programación",
  "Bases de datos",
  "Estadística",
  "Física I",
  "Química general",
  "Contabilidad",
  "Marketing",
  "Derecho",
];
const __languages = ["Inglés", "Portugués", "Italiano", "Francés", "Alemán", "Chino"];
const __instruments = ["Guitarra", "Piano", "Batería", "Bajo", "Violín", "Canto"];

const services = [
  // [CAMBIO] Oficios canónicos por categoría
  ...Object.entries(__servicesByCategory).flatMap(([categoryName, roles]) =>
    (roles || []).map((r) => ({
      name: r,
      description: "Servicio profesional",
      price: 0,
      categoryName,
    }))
  ),

  // Educación generada (se mantiene y NO ensucia: son servicios docentes claros)
  ...__primary.map((s) => ({
    name: `Clases de ${s} (primaria)`,
    description: "Clases personalizadas",
    price: 0,
    categoryName: "Educación · Docente primaria",
  })),
  ...__secondary.map((s) => ({
    name: `Clases de ${s} (secundaria)`,
    description: "Clases personalizadas",
    price: 0,
    categoryName: "Educación · Docente secundaria",
  })),
  ...__university.map((s) => ({
    name: `Apoyo en ${s} (universitario)`,
    description: "Clases personalizadas",
    price: 0,
    categoryName: "Educación · Docente universitaria",
  })),
  ...__languages.map((l) => ({
    name: `Clases de ${l}`,
    description: "Conversación y gramática",
    price: 0,
    categoryName: "Educación · Idiomas",
  })),
  ...__instruments.map((i) => ({
    name: `Clases de ${i}`,
    description: "Técnica e interpretación",
    price: 0,
    categoryName: "Educación · Música",
  })),
]
  .map((service) => ({ ...service, name: capitalizeWords(service.name.trim()) }))
  // Deduplicación estricta por slug (evita duplicados ingeniero/ingeniera, etc.)
  .filter((s, idx, arr) => arr.findIndex((x) => slugify(x.name) === slugify(s.name)) === idx);

// -----------------------------------------------------------------------------
// Seed runner – **Respeta `seedDB`**
// -----------------------------------------------------------------------------
const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("📦 Conectado a MongoDB");

    await CategoryModel.deleteMany();
    await ServiceModel.deleteMany();
    console.log("🧹 Datos antiguos eliminados");

    const insertedCategories = await CategoryModel.insertMany(
      categories.map((cat) => ({ ...cat, name: capitalizeWords(cat.name) }))
    );
    console.log("📚 Categorías insertadas:", insertedCategories.length);

    const categoryMap = {};
    insertedCategories.forEach((cat) => {
      categoryMap[cat.slug] = cat._id;
    });

    const servicesWithCategoryId = services.map((service) => {
      const categorySlug = slugify(service.categoryName);
      const categoryId = categoryMap[categorySlug];
      if (!categoryId) {
        throw new Error(
          `❌ No se encontró la categoría para el servicio: "${service.name}" (${service.categoryName})`
        );
      }
      return {
        ...service,
        name: capitalizeWords(service.name),
        slug: slugify(service.name),
        category: categoryId,
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
