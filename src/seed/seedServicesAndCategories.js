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

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function uniqueStrings(values = []) {
  const seen = new Set();

  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((value) => capitalizeWords(value))
    .filter((value) => {
      const key = normalizeText(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function tokensFromText(value = "") {
  return uniqueStrings(
    normalizeText(value)
      .split(/[^a-z0-9]+/i)
      .map((part) => part.trim())
      .filter((part) => part.length >= 3)
  );
}

const EXTRA_ALIASES = {
  "Contador": ["Contador Público", "Contable", "Contaduría", "Impuestos"],
  "Contador Público": ["Contador", "Contable", "Contaduría"],
  "Administración De Empresas": ["Administrador De Empresas", "Administración", "Gestión Empresarial"],
  "Administrador De Empresas": ["Administración De Empresas", "Gestión Empresarial", "Administración"],
  "Programación": ["Programador", "Coding", "Desarrollo De Software"],
  "Programador": ["Programación", "Desarrollador", "Developer"],
  "Desarrollador": ["Programador", "Desarrollo De Software", "Developer"],
  "Desarrollo De Software": ["Programación", "Desarrollador", "Software Development"],
  "Ingeniería De Software": ["Ingeniero De Software", "Software Engineer"],
  "Ingeniero En Sistemas": ["Analista De Sistemas", "Ingeniería De Sistemas"],
  "Analista De Sistemas": ["Ingeniero En Sistemas", "Sistemas"],
  "Desarrollador Web": ["Frontend", "Backend", "Full Stack", "Programación Web"],
  "Desarrollador Frontend": ["Frontend", "Desarrollador Web", "Ui Developer"],
  "Desarrollador Backend": ["Backend", "Api Developer", "Server Side"],
  "Desarrollador Full Stack": ["Full Stack", "Desarrollador Web"],
  "Desarrollador Mobile": ["Mobile Developer", "App Developer", "React Native"],
  "Devops Engineer": ["Devops", "Infraestructura", "Cloud Engineer"],
  "Administrador De Bases De Datos": ["Dba", "Base De Datos", "Database Administrator"],
  "Dba": ["Administrador De Bases De Datos", "Base De Datos"],
  "Qa Tester": ["Qa", "Testing", "Tester"],
  "Product Manager": ["Pm", "Gestión De Producto"],
  "Scrum Master": ["Agile", "Scrum"],
  "Ux/Ui Designer": ["Ux", "Ui", "Diseño Ux", "Diseño Ui"],
  "Higiene Y Seguridad": ["Seguridad E Higiene", "Higiene Y Seguridad Laboral"],
  "Seguridad E Higiene": ["Higiene Y Seguridad", "Seguridad Laboral"],
  "Ingeniero En Higiene Y Seguridad": [
    "Higiene Y Seguridad",
    "Seguridad E Higiene",
    "Ingeniería En Higiene Y Seguridad",
  ],
  "Técnico En Seguridad E Higiene": [
    "Seguridad E Higiene",
    "Higiene Y Seguridad",
    "Técnico En Higiene Y Seguridad",
  ],
  "Soporte Técnico": ["Help Desk", "Mesa De Ayuda", "Soporte It"],
  "Soporte It": ["Soporte Técnico", "Help Desk", "Mesa De Ayuda"],
  "Técnico Informático": ["Soporte Técnico", "Soporte It", "Técnico Pc"],
  "Técnico Smartphones": ["Soporte De Celulares", "Técnico De Celulares", "Reparación De Celulares"],
  "Técnico De Celulares": ["Soporte De Celulares", "Técnico Smartphones", "Reparación De Celulares"],
  "Administrador De Redes": ["Networking", "Redes", "Infraestructura"],
  "Data Engineer": ["Ingeniería De Datos", "Data Engineering"],
  "Data Analyst": ["Business Intelligence", "Bi", "Analítica De Datos"],
  "Data Scientist": ["Ciencia De Datos", "Machine Learning"],
  "Pentester": ["Seguridad Informática", "Red Team", "Ethical Hacking"],
  "Consultor Grc": ["Compliance", "Gobierno De Riesgo", "Seguridad Informática"],
  "Chofer De Camión": ["Camionero", "Transportista"],
  "Parrillero": ["Asador", "Asador A Domicilio"],
  "Catering": ["Servicio De Lunch", "Lunch", "Lunchs"],
  "Detailer": ["Estética Vehicular", "Detailing", "Lavado Premium"],
  "Mecánico Automotor": ["Mecánico De Autos", "Mecánico"],
  "Mecánico De Motos": ["Mecánico De Moto", "Motos"],
  "Alineación Y Balanceo": ["Tren Delantero", "Balanceo", "Alineación"],
  "Podólogo": ["Podología"],
  "Entrenador Personal": ["Personal Trainer"],
  "Personal De Limpieza": ["Servicio De Limpieza", "Limpieza"],
  "Kiosquero": ["Kiosquero", "Kioquero"],
  "Odontólogo": ["Odontologia"],
  "Oftalmólogo": ["Oculista", "Oftalmologia"],
  "Psicólogo": ["Psicologia"],
  "Kinesiólogo": ["Kinesiologia"],
  "Arquitecto": ["Arquitectura"],
  "Abogado": ["Asesoría Legal", "Legal"],
  "Nutricionista": ["Nutrición"],
  "Gastroenterólogo": ["Gastroenterologia"],
  "Ginecólogo": ["Ginecologia"],
  "Radiólogo": ["Radiologia"],
  "Geólogo": ["Geologia"],
  "Geofísico": ["Geofisica"],
  "Astrónomo": ["Astronomia"],
  "Astrofísico": ["Astrofisica"],
  "Auditor": ["Auditoría", "Auditoria"],
  "Especialista En Medio Ambiente": ["Medio Ambiente", "Ambiental"],
  "Especialista En Energías Renovables": ["Energías Renovables", "Energia Solar", "Renovables"],
  "Actor": ["Actriz", "Actuación"],
  "Influencer": ["Creador De Contenido", "Creador Digital"],
  "Creador De Contenido": ["Influencer", "Content Creator", "Creador Digital"],
  "Bachero": ["Bacha"],
  "Profesor De Historia": ["Docente De Historia", "Historia"],
  "Técnico Agrimensor": ["Agrimensor", "Topógrafo"],
  "Ingeniero Agrimensor": ["Agrimensor", "Topógrafo"],
  "Minero": ["Minería", "Operario Minero"],
};

function buildAliases(name, categoryName) {
  const aliases = [
    ...(EXTRA_ALIASES[capitalizeWords(name)] || []),
    ...(EXTRA_ALIASES[capitalizeWords(categoryName)] || []),
  ];

  return uniqueStrings(aliases);
}

function buildTags(name, categoryName) {
  const categoryParts = String(categoryName || "")
    .split("·")
    .map((part) => capitalizeWords(part.trim()))
    .filter(Boolean);

  return uniqueStrings([
    ...categoryParts,
    ...tokensFromText(name),
    ...tokensFromText(categoryName),
    ...buildAliases(name, categoryName),
  ]);
}

// -----------------------------------------------------------------------------
// Categorías con slug generado (AMPLIAS, AR + generales)
// **Respeta el nombre exacto de tu constante: `categories`**
// -----------------------------------------------------------------------------
const categories = [
  // HOGAR Y MANTENIMIENTO
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

  // TECNOLOGÍA Y SOPORTE
  { name: "Tecnología y soporte · Soporte técnico y Telefonía" },
  { name: "Tecnología y soporte · Redes y Telecomunicaciones" },
  { name: "Tecnología y soporte · Automatización e IoT" },

  // INGENIERÍA DE DATOS
  { name: "Ingeniería de datos · Data Engineering" },
  { name: "Ingeniería de datos · Data Analytics y BI" },
  { name: "Ingeniería de datos · Data Science" },
  { name: "Ingeniería de datos · MLOps" },
  { name: "Ingeniería de datos · Gobernanza de datos" },

  // SEGURIDAD INFORMÁTICA
  { name: "Seguridad informática · Blue Team" },
  { name: "Seguridad informática · Red Team" },
  { name: "Seguridad informática · GRC y Compliance" },

  // INGENIERÍAS
  { name: "Ingenierías · Civil" },
  { name: "Ingenierías · Industrial" },
  { name: "Ingenierías · Química" },
  { name: "Ingenierías · Mecánica" },
  { name: "Ingenierías · Eléctrica" },
  { name: "Ingenierías · Electrónica" },
  { name: "Ingenierías · Sistemas" },
  { name: "Ingenierías · Ambiental" },
  { name: "Ingenierías · Higiene y Seguridad" },
  { name: "Ingenierías · Agronómica" },
  { name: "Ingenierías · Biomédica" },
  { name: "Ingenierías · Telecomunicaciones" },
  { name: "Ingenierías · Geología y Geofísica" },
  { name: "Ingenierías · Energías renovables" },

  // CIENCIAS
  { name: "Ciencias · Astronomía y Astrofísica" },

  // AUTOMOTOR
  { name: "Automotor · Mecánica" },
  { name: "Automotor · Mecánica de motos" },
  { name: "Automotor · Electricidad del automotor" },
  { name: "Automotor · Chapa y pintura" },
  { name: "Automotor · Gomería" },
  { name: "Automotor · Alineación y balanceo" },
  { name: "Automotor · Tren delantero y suspensión" },
  { name: "Automotor · Detailing" },
  { name: "Automotor · Lavado de autos" },
  { name: "Automotor · Auxilio mecánico" },
  { name: "Automotor · Audio y multimedia" },
  { name: "Automotor · Aire acondicionado automotor" },
  { name: "Automotor · Tapizado automotor" },

  // PROFESIONALES Y NEGOCIOS
  { name: "Profesionales y negocios · Contabilidad" },
  { name: "Profesionales y negocios · Administración y empresas" },
  { name: "Profesionales y negocios · Asesoría legal" },
  { name: "Profesionales y negocios · Recursos humanos" },
  { name: "Profesionales y negocios · Marketing" },
  { name: "Profesionales y negocios · Diseño gráfico" },
  { name: "Profesionales y negocios · Redacción y copywriting" },
  { name: "Profesionales y negocios · Traducción" },
  { name: "Profesionales y negocios · Arquitectura" },
  { name: "Profesionales y negocios · Agrimensura" },
  { name: "Profesionales y negocios · Auditoría" },
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

  // SEGURIDAD Y SERVICIO PÚBLICO
  { name: "Seguridad y servicio público · Bomberos" },
  { name: "Seguridad y servicio público · Policía" },

  // SALUD / BIENESTAR / BELLEZA
  { name: "Salud y bienestar · Salud" },
  { name: "Salud y bienestar · Psicología" },
  { name: "Salud y bienestar · Nutrición" },
  { name: "Salud y bienestar · Kinesiología" },
  { name: "Salud y bienestar · Fonoaudiología" },
  { name: "Salud y bienestar · Odontología" },
  { name: "Salud y bienestar · Oftalmología" },
  { name: "Salud y bienestar · Gastroenterología" },
  { name: "Salud y bienestar · Ginecología" },
  { name: "Salud y bienestar · Radiología" },
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

  // EDUCACIÓN
  { name: "Educación · Docente primaria" },
  { name: "Educación · Docente secundaria" },
  { name: "Educación · Docente universitaria" },
  { name: "Educación · Clases particulares" },
  { name: "Educación · Idiomas" },
  { name: "Educación · Música" },
  { name: "Educación · Programación" },
  { name: "Educación · Historia" },
  { name: "Educación · Apoyo escolar" },
  { name: "Educación · Psicopedagogía" },
  { name: "Educación · Educación especial" },
  { name: "Educación · Orientación vocacional" },
  { name: "Educación · Danza y baile" },
  { name: "Educación · Deportes por disciplina" },

  // CUIDADO
  { name: "Cuidado · Niñera" },
  { name: "Cuidado · Cuidado de adultos mayores" },
  { name: "Cuidado · Acompañante terapéutico" },

  // MASCOTAS
  { name: "Mascotas · Veterinaria" },
  { name: "Mascotas · Paseo de perros" },
  { name: "Mascotas · Peluquería canina" },
  { name: "Mascotas · Adiestramiento canino" },
  { name: "Mascotas · Cuidado de mascotas" },
  { name: "Mascotas · Guardería canina" },

  // EVENTOS / GASTRONOMÍA
  { name: "Eventos y gastronomía · Organización de eventos" },
  { name: "Eventos y gastronomía · Mozos y camareras" },
  { name: "Eventos y gastronomía · Bartenders" },
  { name: "Eventos y gastronomía · DJs" },
  { name: "Eventos y gastronomía · Sonido e iluminación" },
  { name: "Eventos y gastronomía · Decoración de eventos" },
  { name: "Eventos y gastronomía · Alquiler de livings" },
  { name: "Eventos y gastronomía · Catering" },
  { name: "Eventos y gastronomía · Lunch y viandas" },
  { name: "Eventos y gastronomía · Chefs a domicilio" },
  { name: "Eventos y gastronomía · Parrilla y asados" },
  { name: "Eventos y gastronomía · Pastelería" },
  { name: "Eventos y gastronomía · Food trucks" },
  { name: "Eventos y gastronomía · Seguridad para eventos" },
  { name: "Eventos y gastronomía · Animación infantil" },
  { name: "Eventos y gastronomía · Wedding planner" },
  { name: "Eventos y gastronomía · Cafetería y barismo" },
  { name: "Eventos y gastronomía · Bacheros y limpieza de cocina" },
  { name: "Eventos y gastronomía · Música en vivo y shows" },

  // ARTE / MEDIOS
  { name: "Arte y medios · Actuación" },
  { name: "Arte y medios · Influencers y creación de contenido" },

  // LOGÍSTICA / TRANSPORTE
  { name: "Logística y transporte · Mensajería y cadetería" },
  { name: "Logística y transporte · Envíos y paquetería" },
  { name: "Logística y transporte · Courier internacional" },
  { name: "Logística y transporte · Fletes" },
  { name: "Logística y transporte · Mudanzas" },
  { name: "Logística y transporte · Traslados y chofer" },
  { name: "Logística y transporte · Cargas pesadas" },

  // INDUSTRIAL / AGRO
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
  { name: "Industrial y agro · Medio ambiente" },

  // TURISMO / OCIO
  { name: "Turismo y ocio · Guía turístico" },
  { name: "Turismo y ocio · Traslados aeropuerto" },
  { name: "Turismo y ocio · Alquiler de vehículos" },
  { name: "Turismo y ocio · Organización de viajes" },

  // ARTE / MANUALIDADES
  { name: "Arte y manualidades · Arte y pintura" },
  { name: "Arte y manualidades · Cerámica" },
  { name: "Arte y manualidades · Manualidades" },
  { name: "Arte y manualidades · Carpintería artística" },

  // COMERCIOS LOCALES
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

  // SERVICIOS FUNERARIOS
  { name: "Servicios funerarios · Cementerio y sepelios" },

  // Catch-all
  { name: "Otras profesiones" },
].map((cat) => ({
  name: capitalizeWords(cat.name),
  slug: slugify(cat.name),
}));

const __servicesByCategory = {
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
  "Hogar y mantenimiento · Limpieza": ["Personal de limpieza", "Servicio de limpieza"],
  "Hogar y mantenimiento · Aire acondicionado": ["Técnico de aire acondicionado"],
  "Hogar y mantenimiento · Calefacción": ["Calefaccionista"],
  "Hogar y mantenimiento · Electrodomésticos": [
    "Técnico en electrodomésticos",
    "Mantenimiento de electrodomésticos",
    "Reparación de electrodomésticos",
  ],
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

  "Tecnología y soporte · Soporte técnico y Telefonía": [
    "Técnico pc",
    "Técnico smartphones",
    "Técnico de celulares",
    "Soporte de celulares",
    "Soporte técnico",
    "Soporte it",
    "Técnico informático",
    "Help desk",
    "Mesa de ayuda",
    "Administrador de sistemas",
    "Sysadmin",
  ],
  "Tecnología y soporte · Redes y Telecomunicaciones": [
    "Técnico redes",
    "Cableador estructurado",
    "Administrador de redes",
    "Especialista telecomunicaciones",
    "Instalador de fibra óptica",
    "Noc",
  ],
  "Tecnología y soporte · Automatización e IoT": [
    "Técnico automatización",
    "Integrador iot",
    "Programador plc",
    "Scada",
    "Domótica",
  ],

  "Ingeniería de datos · Data Engineering": ["Data engineer"],
  "Ingeniería de datos · Data Analytics y BI": ["Data analyst", "Business intelligence analyst"],
  "Ingeniería de datos · Data Science": ["Data scientist"],
  "Ingeniería de datos · MLOps": ["Mlops engineer"],
  "Ingeniería de datos · Gobernanza de datos": ["Data governance"],

  "Seguridad informática · Blue Team": ["Analista blue team", "Soc analyst"],
  "Seguridad informática · Red Team": ["Pentester", "Ethical hacker"],
  "Seguridad informática · GRC y Compliance": ["Consultor grc"],

  "Ingenierías · Civil": ["Ingeniero civil"],
  "Ingenierías · Industrial": ["Ingeniero industrial"],
  "Ingenierías · Química": ["Ingeniero químico"],
  "Ingenierías · Mecánica": ["Ingeniero mecánico"],
  "Ingenierías · Eléctrica": ["Ingeniero electricista"],
  "Ingenierías · Electrónica": ["Ingeniero electrónico"],
  "Ingenierías · Sistemas": [
    "Ingeniero en sistemas",
    "Analista de sistemas",
    "Analista funcional",
    "Arquitecto de software",
    "Ingeniería de software",
    "Desarrollo de software",
    "Programación",
    "Programador",
    "Desarrollador",
    "Desarrollador web",
    "Desarrollador frontend",
    "Desarrollador backend",
    "Desarrollador full stack",
    "Desarrollador mobile",
    "Qa tester",
    "Devops engineer",
    "Administrador de bases de datos",
    "Dba",
    "Ux/ui designer",
    "Product manager",
    "Scrum master",
  ],
  "Ingenierías · Ambiental": ["Ingeniero ambiental"],
  "Ingenierías · Higiene y Seguridad": [
    "Ingeniero en higiene y seguridad",
    "Ingeniería en higiene y seguridad",
    "Higiene y seguridad",
    "Seguridad e higiene",
    "Higiene y seguridad laboral",
  ],
  "Ingenierías · Agronómica": ["Ingeniero agrónomo"],
  "Ingenierías · Biomédica": ["Ingeniero biomédico"],
  "Ingenierías · Telecomunicaciones": ["Ingeniero en telecomunicaciones"],
  "Ingenierías · Geología y Geofísica": [
    "Geólogo",
    "Geofísico",
    "Geologia",
    "Geofisica",
  ],
  "Ingenierías · Energías renovables": [
    "Especialista en energías renovables",
    "Ingeniero en energías renovables",
    "Energías renovables",
  ],

  "Ciencias · Astronomía y Astrofísica": [
    "Astrónomo",
    "Astrofísico",
  ],

  "Automotor · Mecánica": ["Mecánico automotor", "Mecánico de autos"],
  "Automotor · Mecánica de motos": ["Mecánico de motos", "Mecánico de moto"],
  "Automotor · Electricidad del automotor": ["Electricista del automotor"],
  "Automotor · Chapa y pintura": ["Chapista", "Pintor automotor"],
  "Automotor · Gomería": ["Gomero"],
  "Automotor · Alineación y balanceo": ["Alineación y balanceo", "Alineación", "Balanceo"],
  "Automotor · Tren delantero y suspensión": ["Tren delantero", "Suspensión", "Amortiguadores"],
  "Automotor · Detailing": ["Detailer", "Estética vehicular"],
  "Automotor · Lavado de autos": ["Lavadero", "Lavacoches"],
  "Automotor · Auxilio mecánico": ["Auxilio mecánico"],
  "Automotor · Audio y multimedia": ["Instalador car audio"],
  "Automotor · Aire acondicionado automotor": ["Técnico aire acondicionado automotor"],
  "Automotor · Tapizado automotor": ["Tapicero automotor"],

  "Profesionales y negocios · Contabilidad": [
    "Contador",
    "Contador público",
    "Auxiliar contable",
    "Analista contable",
    "Liquidador de sueldos",
    "Impuestos",
  ],
  "Profesionales y negocios · Administración y empresas": [
    "Administración de empresas",
    "Administrador de empresas",
    "Administrativo",
    "Administración",
  ],
  "Profesionales y negocios · Asesoría legal": ["Abogado"],
  "Profesionales y negocios · Recursos humanos": ["Analista rrhh", "Selector"],
  "Profesionales y negocios · Marketing": ["Especialista marketing", "Vendedor e-commerce"],
  "Profesionales y negocios · Diseño gráfico": ["Diseñador gráfico"],
  "Profesionales y negocios · Redacción y copywriting": ["Copywriter", "Redactor"],
  "Profesionales y negocios · Traducción": ["Traductor"],
  "Profesionales y negocios · Arquitectura": ["Arquitecto"],
  "Profesionales y negocios · Agrimensura": ["Técnico agrimensor", "Ingeniero agrimensor", "Agrimensor"],
  "Profesionales y negocios · Auditoría": ["Auditor"],
  "Profesionales y negocios · Inmobiliaria": ["Martillero / corredor inmobiliario"],
  "Profesionales y negocios · Seguridad e higiene": [
    "Técnico en seguridad e higiene",
    "Licenciado en higiene y seguridad",
    "Higiene y seguridad",
    "Seguridad e higiene",
  ],
  "Profesionales y negocios · Producción audiovisual": ["Productor audiovisual", "Editor de video"],
  "Profesionales y negocios · Impresión y gráfica": ["Gráfico / impresiones"],
  "Profesionales y negocios · Community management": ["Community manager"],
  "Profesionales y negocios · Fotografía": ["Fotógrafo"],
  "Profesionales y negocios · Filmación": ["Camarógrafo"],
  "Profesionales y negocios · Gestoría y trámites": ["Gestor de trámites"],
  "Profesionales y negocios · Ventas y comercio": [
    "Vendedor",
    "Ventas",
    "Vendedora",
    "Cajero",
    "Cajera",
    "Repositor",
    "Merchandiser",
    "Atención al cliente",
    "Telemarketer",
    "Preventista",
  ],
  "Profesionales y negocios · Administración de consorcios": ["Administrador de consorcios"],
  "Profesionales y negocios · Finanzas e inversiones": ["Asesor financiero"],
  "Profesionales y negocios · Seguridad privada": ["Vigilador privado", "Control de accesos"],

  "Seguridad y servicio público · Bomberos": ["Bombero"],
  "Seguridad y servicio público · Policía": ["Policía", "Policia"],

  "Salud y bienestar · Salud": ["Médico clínico"],
  "Salud y bienestar · Psicología": ["Psicólogo"],
  "Salud y bienestar · Nutrición": ["Nutricionista"],
  "Salud y bienestar · Kinesiología": ["Kinesiólogo"],
  "Salud y bienestar · Fonoaudiología": ["Fonoaudiólogo"],
  "Salud y bienestar · Odontología": ["Odontólogo"],
  "Salud y bienestar · Oftalmología": ["Oftalmólogo"],
  "Salud y bienestar · Gastroenterología": ["Gastroenterólogo"],
  "Salud y bienestar · Ginecología": ["Ginecólogo"],
  "Salud y bienestar · Radiología": ["Radiólogo"],
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
  "Salud y bienestar · Entrenamiento personal": ["Entrenador personal", "Personal trainer"],
  "Salud y bienestar · Podología": ["Podólogo"],
  "Salud y bienestar · Estética": ["Esteticista"],

  "Educación · Docente primaria": ["Docente primaria"],
  "Educación · Docente secundaria": ["Docente secundaria"],
  "Educación · Docente universitaria": ["Docente universitaria"],
  "Educación · Clases particulares": ["Profesor particular"],
  "Educación · Idiomas": ["Profesor de idiomas"],
  "Educación · Música": ["Profesor de música"],
  "Educación · Programación": [
    "Programación",
    "Instructor de programación",
    "Profesor de programación",
    "Tutor de programación",
    "Desarrollo web",
    "Robótica educativa",
  ],
  "Educación · Historia": ["Profesor de historia"],
  "Educación · Apoyo escolar": ["Tutor académico"],
  "Educación · Psicopedagogía": ["Psicopedagogo"],
  "Educación · Educación especial": ["Docente educación especial"],
  "Educación · Orientación vocacional": ["Orientador vocacional"],
  "Educación · Danza y baile": ["Profesor de baile"],
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

  "Cuidado · Niñera": ["Niñera"],
  "Cuidado · Cuidado de adultos mayores": ["Cuidador de adultos mayores"],
  "Cuidado · Acompañante terapéutico": ["Acompañante terapéutico"],

  "Mascotas · Veterinaria": ["Veterinario"],
  "Mascotas · Paseo de perros": ["Paseador de perros"],
  "Mascotas · Peluquería canina": ["Peluquero canino"],
  "Mascotas · Adiestramiento canino": ["Adiestrador canino"],
  "Mascotas · Cuidado de mascotas": ["Petsitter"],
  "Mascotas · Guardería canina": ["Guardería canina"],

  "Eventos y gastronomía · Organización de eventos": ["Organizador de eventos", "Coordinador de eventos"],
  "Eventos y gastronomía · Mozos y camareras": ["Mozo", "Camarero", "Camarera"],
  "Eventos y gastronomía · Bartenders": ["Bartender"],
  "Eventos y gastronomía · DJs": ["Dj"],
  "Eventos y gastronomía · Sonido e iluminación": ["Sonidista", "Iluminador"],
  "Eventos y gastronomía · Decoración de eventos": ["Decorador de eventos", "Ambientador"],
  "Eventos y gastronomía · Alquiler de livings": ["Alquiler de livings"],
  "Eventos y gastronomía · Catering": [
    "Catering",
    "Servicio de lunch",
    "Lunch",
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
  "Eventos y gastronomía · Lunch y viandas": ["Servicio de lunch", "Lunch", "Viandas"],
  "Eventos y gastronomía · Chefs a domicilio": ["Chef", "Chef a domicilio"],
  "Eventos y gastronomía · Parrilla y asados": ["Parrillero", "Asador", "Asador a domicilio"],
  "Eventos y gastronomía · Pastelería": ["Pastelero"],
  "Eventos y gastronomía · Food trucks": ["Food truck"],
  "Eventos y gastronomía · Seguridad para eventos": ["Seguridad para eventos"],
  "Eventos y gastronomía · Animación infantil": ["Animador infantil"],
  "Eventos y gastronomía · Wedding planner": ["Wedding planner"],
  "Eventos y gastronomía · Cafetería y barismo": ["Barista", "Baristas"],
  "Eventos y gastronomía · Bacheros y limpieza de cocina": ["Bachero", "Bacha"],
  "Eventos y gastronomía · Música en vivo y shows": ["Músico", "Banda", "Cantante", "Dúo acústico"],

  "Arte y medios · Actuación": ["Actor", "Actriz"],
  "Arte y medios · Influencers y creación de contenido": [
    "Influencer",
    "Creador de contenido",
    "Creador digital",
    "Content creator",
  ],

  "Logística y transporte · Mensajería y cadetería": ["Mensajero", "Cadete"],
  "Logística y transporte · Envíos y paquetería": ["Paquetería"],
  "Logística y transporte · Courier internacional": ["Courier internacional"],
  "Logística y transporte · Fletes": ["Fletero"],
  "Logística y transporte · Mudanzas": ["Mudanzas"],
  "Logística y transporte · Traslados y chofer": [
    "Chofer",
    "Chofer particular",
    "Chofer de camión",
    "Camionero",
    "Chofer de colectivo",
    "Chofer de grúa",
    "Remisero",
    "Taxista",
    "Autoelevadorista",
  ],
  "Logística y transporte · Cargas pesadas": ["Operador de grúa", "Grúista"],

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
    "Minero",
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
  "Industrial y agro · Medio ambiente": ["Especialista en medio ambiente"],

  "Turismo y ocio · Guía turístico": ["Guía de turismo"],
  "Turismo y ocio · Traslados aeropuerto": ["Transferista"],
  "Turismo y ocio · Alquiler de vehículos": ["Alquiler de vehículos"],
  "Turismo y ocio · Organización de viajes": ["Organizador de viajes"],

  "Arte y manualidades · Arte y pintura": ["Artista", "Pintor mural"],
  "Arte y manualidades · Cerámica": ["Ceramista"],
  "Arte y manualidades · Manualidades": ["Artesano"],
  "Arte y manualidades · Carpintería artística": ["Carpintero artístico"],

  "Comercios locales · Kiosco": ["Kiosquero", "Kioquero"],
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

  "Servicios funerarios · Cementerio y sepelios": ["Sepulturero", "Servicios de sepelio"],

  "Otras profesiones": ["Profesional independiente"],
};

// -----------------------------------------------------------------------------
// Construcción de `services` SOLO con OFICIOS (sin tareas) + extras educativos.
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
  "Física i",
  "Química general",
  "Contabilidad",
  "Marketing",
  "Derecho",
];
const __languages = ["Inglés", "Portugués", "Italiano", "Francés", "Alemán", "Chino"];
const __instruments = ["Guitarra", "Piano", "Batería", "Bajo", "Violín", "Canto"];

const rawServices = [
  ...Object.entries(__servicesByCategory).flatMap(([categoryName, roles]) =>
    (roles || []).map((role) => ({
      name: role,
      description: "Servicio profesional",
      price: 0,
      categoryName,
    }))
  ),

  ...__primary.map((subject) => ({
    name: `Clases de ${subject} (primaria)`,
    description: "Clases personalizadas",
    price: 0,
    categoryName: "Educación · Docente primaria",
  })),
  ...__secondary.map((subject) => ({
    name: `Clases de ${subject} (secundaria)`,
    description: "Clases personalizadas",
    price: 0,
    categoryName: "Educación · Docente secundaria",
  })),
  ...__university.map((subject) => ({
    name: `Apoyo en ${subject} (universitario)`,
    description: "Clases personalizadas",
    price: 0,
    categoryName: "Educación · Docente universitaria",
  })),
  ...__languages.map((language) => ({
    name: `Clases de ${language}`,
    description: "Conversación y gramática",
    price: 0,
    categoryName: "Educación · Idiomas",
  })),
  ...__instruments.map((instrument) => ({
    name: `Clases de ${instrument}`,
    description: "Técnica e interpretación",
    price: 0,
    categoryName: "Educación · Música",
  })),
].map((service) => ({
  ...service,
  name: capitalizeWords(service.name.trim()),
}));

const services = rawServices
  .filter((service, index, array) => {
    return array.findIndex((item) => slugify(item.name) === slugify(service.name)) === index;
  })
  .map((service) => ({
    ...service,
    aliases: buildAliases(service.name, service.categoryName),
    tags: buildTags(service.name, service.categoryName),
  }));

// -----------------------------------------------------------------------------
// Seed runner – **Respeta `seedDB`**
// -----------------------------------------------------------------------------
const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    // eslint-disable-next-line no-console
    console.log("📦 Conectado a MongoDB");

    await CategoryModel.deleteMany();
    await ServiceModel.deleteMany();
    // eslint-disable-next-line no-console
    console.log("🧹 Datos antiguos eliminados");

    const insertedCategories = await CategoryModel.insertMany(
      categories.map((cat) => ({ ...cat, name: capitalizeWords(cat.name) }))
    );
    // eslint-disable-next-line no-console
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
        name: capitalizeWords(service.name),
        slug: slugify(service.name),
        description: service.description,
        price: service.price,
        category: categoryId,
        aliases: uniqueStrings(service.aliases),
        tags: uniqueStrings(service.tags),
      };
    });

    const insertedServices = await ServiceModel.insertMany(servicesWithCategoryId);
    // eslint-disable-next-line no-console
    console.log("🛠️ Servicios insertados:", insertedServices.length);

    await mongoose.connection.close();
    // eslint-disable-next-line no-console
    console.log("✅ Seed completado y conexión cerrada");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("❌ Error en el seed:", error);
    process.exit(1);
  }
};

seedDB();

/*
[CAMBIOS HECHOS AQUÍ]
- Se agregaron nuevas categorías y servicios faltantes en geología, geofísica, astronomía, astrofísica, auditoría, administración de empresas, gastroenterología, ginecología, radiología, actuación e influencers/creación de contenido.
- Se sumaron servicios exactos y buscables como Abogado, Contador, Profesor De Historia, Técnico Agrimensor, Ingeniero Agrimensor, Arquitecto, Nutricionista, Gastroenterólogo, Ginecólogo, Radiólogo, Minero, Especialista En Medio Ambiente, Auditor, Especialista En Energías Renovables, Actor, Influencer, Creador De Contenido y Bachero.
- Se mantuvo la estructura general para no romper FE WEB ni MOBILE.
- Se fortalecieron aliases y tags para que la búsqueda encuentre mejor aún aunque el usuario escriba variantes.
*/