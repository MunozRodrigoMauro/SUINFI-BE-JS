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

// -----------------------------------------------------------------------------
// Categorías con slug generado (AMPLIAS, AR + generales)
// **Respeta el nombre exacto de tu constante: `categories`**
// -----------------------------------------------------------------------------
const categories = [
  // Hogar / Mantenimiento
  { name: "Electricidad" },
  { name: "Plomería" },
  { name: "Gas" },
  { name: "Albañilería" },
  { name: "Carpintería" },
  { name: "Herrería" },
  { name: "Cerrajería" },
  { name: "Pintura" },
  { name: "Construcción en seco" },
  { name: "Impermeabilización" },
  { name: "Jardinería" },
  { name: "Parquización" },
  { name: "Riego automático" },
  { name: "Piscinas" },
  { name: "Control de plagas" },
  { name: "Limpieza" },
  { name: "Aire acondicionado" },
  { name: "Calefacción" },
  { name: "Electrodomésticos" },
  { name: "Vidriería" },
  { name: "Techos y zinguería" },
  { name: "Yesería" },
  { name: "Persianas y cortinas" },
  { name: "Pisos y revestimientos" },
  { name: "Domótica" },
  { name: "Energía solar" },
  { name: "Seguridad (CCTV y alarmas)" },
  { name: "Mudanzas y fletes" },
  { name: "Tapicería" },

  // Tecnología / IT
  { name: "Tecnología" },
  { name: "Soporte técnico" },
  { name: "Redes" },
  { name: "Telefonía" },
  { name: "Informática" },
  { name: "Diseño web" },
  { name: "Desarrollo web" },
  { name: "UX/UI" },
  { name: "Ciberseguridad" },
  { name: "Datos y BI" },
  { name: "Automatización e IoT" },
  { name: "IA y Machine Learning" },
  { name: "QA / Testing" },
  { name: "DevOps" },
  { name: "Cloud" },
  { name: "Bases de datos" },

  // Automotor
  { name: "Mecánica" },
  { name: "Electricidad del automotor" },
  { name: "Chapa y pintura" },
  { name: "Gomería" },
  { name: "Detailing" },
  { name: "Lavado de autos" },
  { name: "Auxilio mecánico" },
  { name: "Audio y multimedia" },
  { name: "Aire acondicionado automotor" },
  { name: "Tapizado automotor" },

  // Profesionales y negocios
  { name: "Contabilidad" },
  { name: "Asesoría legal" },
  { name: "Recursos humanos" },
  { name: "Marketing" },
  { name: "Diseño gráfico" },
  { name: "Redacción y copywriting" },
  { name: "Traducción" },
  { name: "Arquitectura" },
  { name: "Ingeniería" },
  { name: "Agrimensura" },
  { name: "Inmobiliaria" },
  { name: "Seguridad e higiene" },
  { name: "Producción audiovisual" },
  { name: "Impresión y gráfica" },
  { name: "Community management" },
  { name: "Fotografía" },
  { name: "Filmación" },
  { name: "Gestoría y trámites" },

  // Salud / Bienestar / Belleza
  { name: "Salud" },
  { name: "Bienestar" },
  { name: "Psicología" },
  { name: "Nutrición" },
  { name: "Kinesiología" },
  { name: "Fonoaudiología" },
  { name: "Odontología" },
  { name: "Enfermería" },
  { name: "Peluquería" },
  { name: "Barbería" },
  { name: "Maquillaje" },
  { name: "Depilación" },
  { name: "Uñas" },
  { name: "Cosmetología" },
  { name: "Masajes" },
  { name: "Spa" },
  { name: "Entrenamiento personal" },
  { name: "Coaching" },
  { name: "Podología" },

  // Educación / Capacitación
  { name: "Educación" },
  { name: "Docente primaria" },
  { name: "Docente secundaria" },
  { name: "Docente universitaria" },
  { name: "Clases particulares" },
  { name: "Idiomas" },
  { name: "Música" },
  { name: "Programación" },
  { name: "Apoyo escolar" },
  { name: "Psicopedagogía" },
  { name: "Educación especial" },
  { name: "Orientación vocacional" },

  // Cuidado
  { name: "Niñera" },
  { name: "Cuidado de adultos mayores" },
  { name: "Acompañante terapéutico" },

  // Mascotas
  { name: "Veterinaria" },
  { name: "Paseo de perros" },
  { name: "Peluquería canina" },
  { name: "Adiestramiento canino" },
  { name: "Cuidado de mascotas" },
  { name: "Guardería canina" },

  // Eventos / Gastronomía
  { name: "Organización de eventos" },
  { name: "Mozos y camareras" },
  { name: "Bartenders" },
  { name: "DJs" },
  { name: "Sonido e iluminación" },
  { name: "Decoración de eventos" },
  { name: "Alquiler de livings" },
  { name: "Catering" },
  { name: "Chefs a domicilio" },
  { name: "Pastelería" },
  { name: "Food trucks" },
  { name: "Seguridad para eventos" },
  { name: "Animación infantil" },
  { name: "Wedding planner" },

  // Logística / Transporte
  { name: "Mensajería y cadetería" },
  { name: "Envíos y paquetería" },
  { name: "Courier internacional" },
  { name: "Fletes" },
  { name: "Mudanzas" },
  { name: "Traslados y chofer" },
  { name: "Cargas pesadas" },

  // Industrial / Agro
  { name: "Soldadura industrial" },
  { name: "Tornería y fresado" },
  { name: "Electricidad industrial" },
  { name: "Montajes industriales" },
  { name: "Refrigeración industrial" },
  { name: "Seguridad industrial" },
  { name: "Agricultura" },
  { name: "Riego agrícola" },
  { name: "Maquinaria agrícola" },

  // Turismo / Ocio
  { name: "Guía turístico" },
  { name: "Traslados aeropuerto" },
  { name: "Alquiler de vehículos" },
  { name: "Organización de viajes" },

  // Arte / Manualidades
  { name: "Arte y pintura" },
  { name: "Cerámica" },
  { name: "Manualidades" },
  { name: "Carpintería artística" },

  // Catch-all
  { name: "Otras profesiones" },
].map((cat) => ({
  name: capitalizeWords(cat.name),
  slug: slugify(cat.name),
}));

// -----------------------------------------------------------------------------
// Servicios (muchos, generados por categoría) – **Respeta `services`**
// NOTA: se pueden agregar más sin tocar la lógica.
// -----------------------------------------------------------------------------

// Diccionario base: categoria -> [servicios]
const __baseByCategory = {
  // Hogar / Mantenimiento
  "Electricidad": [
    "Instalación eléctrica completa",
    "Reparación de enchufes y llaves",
    "Tablero eléctrico y disyuntor",
    "Colocación de luminarias",
    "Cableado y canalizaciones",
  ],
  "Plomería": [
    "Reparación de caños",
    "Destapación de cloacas",
    "Instalación de grifería",
    "Colocación de sanitarios",
    "Detección de pérdidas",
  ],
  "Gas": [
    "Instalación de gas (matriculado)",
    "Conexión de cocina",
    "Cambio de flexibles y llaves",
    "Prueba de hermeticidad",
  ],
  "Albañilería": [
    "Colocación de cerámicos",
    "Revoque y enduido",
    "Reparación de humedad",
    "Construcción de muros",
  ],
  "Carpintería": [
    "Armado de muebles a medida",
    "Colocación de puertas y marcos",
    "Placares y vestidores",
    "Decks y pérgolas",
  ],
  "Herrería": ["Soldaduras y reparaciones", "Rejas y portones", "Estructuras metálicas"],
  "Cerrajería": ["Apertura de puertas", "Cambio de cerraduras", "Copias de llaves (in situ)"],
  "Pintura": ["Pintura interior", "Pintura exterior", "Impermeabilizantes", "Texturados y efectos"],
  "Construcción en seco": ["Durlock tabiques", "Cielorrasos", "Aislamiento acústico"],
  "Impermeabilización": ["Membrana en terrazas", "Sellado de filtraciones"],
  "Jardinería": ["Corte de césped", "Poda de arbustos", "Parquizaciones"],
  "Parquización": ["Diseño de espacios verdes", "Colocación de césped"],
  "Riego automático": ["Instalación de riego por aspersión", "Mantenimiento de sistema de riego"],
  "Piscinas": ["Mantenimiento de piscinas", "Colocación de bombas y filtros"],
  "Control de plagas": ["Desinfección de cucarachas", "Desratización"],
  "Limpieza": ["Limpieza profunda de hogar", "Limpieza post-obra", "Limpieza de final de obra"],
  "Aire acondicionado": ["Instalación split", "Mantenimiento y recarga", "Reparación de aire acondicionado"],
  "Calefacción": ["Instalación de calefactores", "Revisión de calefacción"],
  "Electrodomésticos": ["Reparación de heladeras", "Reparación de lavarropas", "Reparación de microondas"],
  "Vidriería": ["Colocación de vidrios", "DVH y cerramientos"],
  "Techos y zinguería": ["Reparación de techos", "Colocación de canaletas"],
  "Yesería": ["Yeso en interiores", "Cielorrasos de yeso"],
  "Persianas y cortinas": ["Arreglo de persianas", "Colocación de cortinas"],
  "Pisos y revestimientos": ["Pisos flotantes", "Porcelanato"],
  "Domótica": ["Automatización de hogar", "Instalación smart home"],
  "Energía solar": ["Colocación de paneles solares", "Sistemas off-grid"],
  "Seguridad (CCTV y alarmas)": ["Instalación de cámaras", "Instalación de alarmas"],
  "Mudanzas y fletes": ["Flete por hora", "Mudanza completa"],
  "Tapicería": ["Retapizado de sillones", "Tapizado automotor"],

  // Tecnología / IT
  "Tecnología": ["Reparación de PC", "Reparación de notebook", "Optimización del sistema"],
  "Soporte técnico": ["Instalación de software", "Backup y recuperación"],
  "Redes": ["Cableado estructurado", "Configuración de routers"],
  "Telefonía": ["Reparación de smartphones", "Cambio de pantallas"],
  "Informática": ["Limpieza de virus", "Puesta a punto"],
  "Diseño web": ["Landing page", "Sitio institucional"],
  "Desarrollo web": ["E-commerce", "Aplicación web a medida"],
  "UX/UI": ["Diseño de interfaces", "Prototipado"],
  "Ciberseguridad": ["Hardening y auditoría", "Pruebas de penetración (pentest)"] ,
  "Datos y BI": ["Dashboards y reportes", "ETL y modelado"],
  "Automatización e IoT": ["Sensores y automatismos", "PLC/SCADA básico"],
  "IA y Machine Learning": ["Chatbots y asistentes", "Modelos de predicción"],
  "QA / Testing": ["Pruebas funcionales", "Automatización de pruebas"],
  "DevOps": ["CI/CD básico", "Infra como código"],
  "Cloud": ["AWS básico", "GCP/Azure básico"],
  "Bases de datos": ["Modelado de datos", "Optimización de consultas"],

  // Automotor
  "Mecánica": ["Service completo", "Frenos y embrague", "Cambio de correas"],
  "Electricidad del automotor": ["Alternador y arranque", "Luces y cableado"],
  "Chapa y pintura": ["Reparación de golpes", "Pintura parcial"],
  "Gomería": ["Cambio de neumáticos", "Balanceo y alineación"],
  "Detailing": ["Pulido y encerado", "Limpieza integral"],
  "Lavado de autos": ["Lavado básico", "Lavado premium"],
  "Auxilio mecánico": ["Remolque urbano", "Arranque de batería"],
  "Audio y multimedia": ["Instalación de estéreo", "Cámaras traseras"],
  "Aire acondicionado automotor": ["Carga de gas", "Reparación de compresor"],
  "Tapizado automotor": ["Tapizado de butacas", "Volantes y paneles"],

  // Profesionales y negocios
  "Contabilidad": ["Monotributo y autónomos", "Declaraciones juradas"],
  "Asesoría legal": ["Consulta legal", "Contratos y acuerdos"],
  "Recursos humanos": ["Reclutamiento y selección", "Payroll (básico)"],
  "Marketing": ["Publicidad en redes", "Estrategia digital"],
  "Diseño gráfico": ["Identidad visual", "Piezas para redes"],
  "Redacción y copywriting": ["Copy para anuncios", "Artículos de blog"],
  "Traducción": ["Traducción técnico-legal", "Traducción simple"],
  "Arquitectura": ["Planos y permisos", "Dirección de obra"],
  "Ingeniería": ["Cálculo estructural", "Planos eléctricos"],
  "Agrimensura": ["Mensuras y subdivisiones", "Relevamientos"],
  "Inmobiliaria": ["Tasaciones", "Administración de alquileres"],
  "Seguridad e higiene": ["Capacitaciones", "Matriz de riesgos"],
  "Producción audiovisual": ["Filmación de eventos", "Edición de video"],
  "Impresión y gráfica": ["Gran formato", "Merchandising"],
  "Community management": ["Gestión de redes", "Calendario de contenido"],
  "Fotografía": ["Sesión de fotos", "Cobertura de eventos"],
  "Filmación": ["Video de eventos", "Edición profesional"],
  "Gestoría y trámites": ["Gestoría automotor", "Habilitaciones municipales"],

  // Salud / Bienestar / Belleza
  "Salud": ["Médico clínico (consulta)", "Enfermería a domicilio"],
  "Psicología": ["Psicoterapia individual", "Terapia de pareja"],
  "Nutrición": ["Consulta nutricional", "Plan alimentario"],
  "Kinesiología": ["Rehabilitación", "Kinesiología deportiva"],
  "Fonoaudiología": ["Reeducación del habla", "Terapia deglución"],
  "Odontología": ["Limpieza dental", "Arreglo de caries"],
  "Enfermería": ["Curaciones", "Aplicación de inyecciones"],
  "Peluquería": ["Corte de cabello", "Color y reflejos"],
  "Barbería": ["Corte y barba", "Afeitado clásico"],
  "Maquillaje": ["Social y eventos", "Novias"],
  "Depilación": ["Cera tradicional", "Depilación definitiva"],
  "Uñas": ["Uñas esculpidas", "Semipermanente"],
  "Cosmetología": ["Limpieza facial", "Tratamientos antiacné"],
  "Masajes": ["Relajante", "Descontracturante"],
  "Spa": ["Day spa", "Circuito húmedo"],
  "Entrenamiento personal": ["Personal trainer", "Plan de entrenamiento"],
  "Podología": ["Tratamiento de callos", "Uñas encarnadas"],

  // Educación / Capacitación
  "Educación": ["Clases de apoyo", "Técnicas de estudio"],
  "Docente primaria": ["Clases de lengua (primaria)", "Clases de matemática (primaria)"],
  "Docente secundaria": ["Clases de matemática (secundaria)", "Clases de física (secundaria)"],
  "Docente universitaria": ["Apoyo en análisis matemático", "Apoyo en programación"],
  "Clases particulares": ["Apoyo escolar a domicilio", "Clases online"],
  "Idiomas": ["Clases de inglés", "Clases de portugués", "Clases de francés"],
  "Música": ["Clases de guitarra", "Clases de piano", "Canto"],
  "Programación": ["JavaScript desde cero", "React para principiantes"],
  "Apoyo escolar": ["Tareas y resúmenes", "Técnicas de estudio"],
  "Psicopedagogía": ["Evaluación psicopedagógica", "Acompañamiento escolar"],
  "Educación especial": ["Acompañante terapéutico", "Apoyos específicos"],
  "Orientación vocacional": ["Test y entrevistas", "Taller grupal"],

  // Cuidado
  "Niñera": ["Cuidado de niños por hora", "Niñera nocturna"],
  "Cuidado de adultos mayores": ["Acompañamiento diurno", "Acompañamiento nocturno"],
  "Acompañante terapéutico": ["Apoyo domiciliario", "Asistencia en instituciones"],

  // Mascotas
  "Veterinaria": ["Vacunación", "Consulta clínica"],
  "Paseo de perros": ["Paseo individual", "Paseo grupal"],
  "Peluquería canina": ["Baño y corte", "Deslanado"],
  "Adiestramiento canino": ["Obediencia básica", "Modificación de conducta"],
  "Cuidado de mascotas": ["Petsitter a domicilio", "Guardería por día"],
  "Guardería canina": ["Guardería diurna", "Guardería nocturna"],

  // Eventos / Gastronomía
  "Organización de eventos": ["Organizador integral", "Coordinador de evento"],
  "Mozos y camareras": ["Servicio de mozos", "Armado y desmontaje"],
  "Bartenders": ["Barra clásica", "Barra premium"],
  "DJs": ["DJ social", "DJ corporativo"],
  "Sonido e iluminación": ["Alquiler de sonido", "Iluminación para eventos"],
  "Decoración de eventos": ["Decoración temática", "Globología y flores"],
  "Alquiler de livings": ["Livings y gazebos", "Alquiler de vajilla"],
  "Catering": ["Catering finger food", "Catering formal"],
  "Chefs a domicilio": ["Chef para cenas", "Clases de cocina"],
  "Pastelería": ["Tortas personalizadas", "Mesa dulce"],
  "Food trucks": ["Food truck para eventos", "Street food"],
  "Seguridad para eventos": ["Control de accesos", "Vigilancia"],
  "Animación infantil": ["Animación con juegos", "Shows infantiles"],
  "Wedding planner": ["Planificación integral", "Coordinación día del evento"],

  // Logística / Transporte
  "Mensajería y cadetería": ["Mensajería en moto", "Trámites y diligencias"],
  "Envíos y paquetería": ["Envío same-day", "Gestión de paquetes"],
  "Courier internacional": ["Puerta a puerta", "Despacho básico"],
  "Fletes": ["Flete chico", "Flete mediano"],
  "Mudanzas": ["Mudanza local", "Mudanza larga distancia"],
  "Traslados y chofer": ["Chofer particular", "Traslado aeropuerto"],
  "Cargas pesadas": ["Grúas y movimiento", "Logística industrial"],

  // Industrial / Agro
  "Soldadura industrial": ["Soldadura MIG/MAG/TIG", "Estructuras pesadas"],
  "Tornería y fresado": ["Piezas a medida", "Mantenimiento de precisión"],
  "Electricidad industrial": ["Tableros industriales", "Motores y variadores"],
  "Montajes industriales": ["Montaje de líneas", "Calderería básica"],
  "Refrigeración industrial": ["Cámaras frigoríficas", "Chillers"],
  "Seguridad industrial": ["Planes de seguridad", "Capacitaciones"],
  "Agricultura": ["Siembra y cosecha", "Aplicaciones"],
  "Riego agrícola": ["Instalación de pivots", "Goteo tecnificado"],
  "Maquinaria agrícola": ["Mantenimiento de tractores", "Reparación de implementos"],

  // Turismo / Ocio
  "Guía turístico": ["City tour", "Excursiones"],
  "Traslados aeropuerto": ["Traslados privados", "Shuttle compartido"],
  "Alquiler de vehículos": ["Alquiler con chofer", "Alquiler sin chofer"],
  "Organización de viajes": ["Itinerarios a medida", "Reservas y asistencia"],

  // Arte / Manualidades
  "Arte y pintura": ["Murales", "Cuadros personalizados"],
  "Cerámica": ["Taller de cerámica", "Piezas por encargo"],
  "Manualidades": ["Souvenirs personalizados", "Artesanías a medida"],
  "Carpintería artística": ["Tallado en madera", "Restauración artística"],

  // Catch-all
  "Otras profesiones": ["Servicio personalizado", "Consulta a medida"],
};

// Generadores adicionales para Educación (materias, idiomas, música)
const __primary = ["Lengua", "Matemática", "Ciencias naturales", "Ciencias sociales", "Inglés básico"];
const __secondary = ["Matemática", "Física", "Química", "Biología", "Historia", "Geografía", "Lengua y literatura", "Filosofía", "Economía", "Informática"];
const __university = ["Análisis matemático", "Álgebra", "Programación", "Bases de datos", "Estadística", "Física I", "Química general", "Contabilidad", "Marketing", "Derecho"];
const __languages = ["Inglés", "Portugués", "Italiano", "Francés", "Alemán", "Chino"];
const __instruments = ["Guitarra", "Piano", "Batería", "Bajo", "Violín", "Canto"];

// Construimos el gran arreglo de servicios
const services = [
  // --- Los que ya tenías (para mantener consistencia) ---
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

  // --- Masivo: expandimos por categoría ---
  ...Object.entries(__baseByCategory).flatMap(([categoryName, arr]) => (
    arr.map((n) => ({ name: n, description: "Servicio profesional", price: 5000, categoryName }))
  )),

  // --- Educación generada ---
  ...__primary.map((s) => ({ name: `Clases de ${s} (primaria)`, description: "Clases personalizadas", price: 3000, categoryName: "Docente primaria" })),
  ...__secondary.map((s) => ({ name: `Clases de ${s} (secundaria)`, description: "Clases personalizadas", price: 3500, categoryName: "Docente secundaria" })),
  ...__university.map((s) => ({ name: `Apoyo en ${s} (universitario)`, description: "Clases personalizadas", price: 4000, categoryName: "Docente universitaria" })),
  ...__languages.map((l) => ({ name: `Clases de ${l}`, description: "Conversación y gramática", price: 3500, categoryName: "Idiomas" })),
  ...__instruments.map((i) => ({ name: `Clases de ${i}`, description: "Técnica e interpretación", price: 3500, categoryName: "Música" })),
].map((service) => ({
  ...service,
  name: capitalizeWords(service.name),
}))
  // Evitar posibles duplicados por nombre
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

    const insertedCategories = await CategoryModel.insertMany(categories);
    console.log("📚 Categorías insertadas:", insertedCategories.length);

    const categoryMap = {};
    insertedCategories.forEach((cat) => {
      categoryMap[cat.slug] = cat._id;
    });

    const servicesWithCategoryId = services.map((service) => {
      const categorySlug = slugify(service.categoryName);
      const categoryId = categoryMap[categorySlug];
      if (!categoryId) {
        throw new Error(`❌ No se encontró la categoría para el servicio: "${service.name}" (${service.categoryName})`);
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
