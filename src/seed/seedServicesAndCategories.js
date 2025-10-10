  // src/seed/seedServicesAndCategories.js

  /**
   * SUINFI – Seed de Categorías y Servicios (versión jerárquica plana, ampliada)
   *
   * Cambios:
   * - [CAMBIO] Reorganización total de `categories` en categorías MADRE y SUBCATEGORÍAS codificadas como:
   *            "Madre · Subcategoría" (no se toca el modelo, solo el nombre).
   * - [CAMBIO] `__baseByCategory` rehecho con muchos servicios por subcategoría.
   * - [CAMBIO] Servicio heredado que usaba "Tecnología" ahora usa
   *            "Tecnología y soporte · Soporte técnico y Telefonía".
   * - [SIN CAMBIOS] Flujo de conexión y seedDB intactos.
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
  // [CAMBIO] Jerarquía coherente: categorías madres y subcategorías (nombre plano).
  // -----------------------------------------------------------------------------
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
    // TECNOLOGÍA Y SOPORTE  (antes "Tecnología", "Informática", "Redes", "Telefonía")
    // =========================
    { name: "Tecnología y soporte · Soporte técnico y Telefonía" },
    { name: "Tecnología y soporte · Redes y Telecomunicaciones" },
    { name: "Tecnología y soporte · Automatización e IoT" },

    // =========================
    // DESARROLLO DE SOFTWARE  (saca de categorías sueltas: UX/UI, DevOps, Cloud, Bases de datos, etc.)
    // =========================
    { name: "Desarrollo de software · Frontend" },
    { name: "Desarrollo de software · Backend" },
    { name: "Desarrollo de software · Fullstack" },
    { name: "Desarrollo de software · Mobile" },
    { name: "Desarrollo de software · Arquitectura" },
    { name: "Desarrollo de software · QA/Testing" },
    { name: "Desarrollo de software · DevOps" },
    { name: "Desarrollo de software · Cloud" },
    { name: "Desarrollo de software · Bases de datos" },
    { name: "Desarrollo de software · Producto · UX/UI" },
    { name: "Desarrollo de software · Producto · Research" },
    { name: "Desarrollo de software · Producto · Diseño visual" },

    // =========================
    // INGENIERÍA DE DATOS (reemplaza "Datos y BI" y "IA y Machine Learning" como subáreas)
    // =========================
    { name: "Ingeniería de datos · Data Engineering" },
    { name: "Ingeniería de datos · Data Analytics y BI" },
    { name: "Ingeniería de datos · Data Science" },
    { name: "Ingeniería de datos · MLOps" },
    { name: "Ingeniería de datos · Gobernanza de datos" },

    // =========================
    // SEGURIDAD INFORMÁTICA (reemplaza "Ciberseguridad" suelta)
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
    { name: "Ingenierías · Sistemas" },
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

    // Catch-all
    { name: "Otras profesiones" },
  ].map((cat) => ({
    name: capitalizeWords(cat.name),
    slug: slugify(cat.name),
  }));

  // -----------------------------------------------------------------------------
  // Servicios (muchos, generados por categoría) – **Respeta `services`**.
  // [CAMBIO] Reasignado a nuevas subcategorías coherentes.
  // -----------------------------------------------------------------------------

  const __baseByCategory = {
    // =========================
    // HOGAR Y MANTENIMIENTO
    // =========================
    "Hogar y mantenimiento · Electricidad": [
      "Instalación eléctrica completa",
      "Reparación de enchufes y llaves",
      "Tablero eléctrico y disyuntor",
      "Colocación de luminarias",
      "Cableado y canalizaciones",
      "Puesta a tierra y mediciones",
    ],
    "Hogar y mantenimiento · Plomería": [
      "Reparación de caños",
      "Destapación de cloacas",
      "Instalación de grifería",
      "Colocación de sanitarios",
      "Detección de pérdidas",
      "Instalación de termotanques",
    ],
    "Hogar y mantenimiento · Gas": [
      "Instalación de gas (matriculado)",
      "Conexión de cocina",
      "Cambio de flexibles y llaves",
      "Prueba de hermeticidad",
      "Mudanza de medidor (según normativa)",
    ],
    "Hogar y mantenimiento · Albañilería": [
      "Colocación de cerámicos",
      "Revoque y enduido",
      "Reparación de humedad",
      "Construcción de muros",
      "Colocación de porcelanato",
    ],
    "Hogar y mantenimiento · Carpintería": [
      "Armado de muebles a medida",
      "Colocación de puertas y marcos",
      "Placares y vestidores",
      "Decks y pérgolas",
    ],
    "Hogar y mantenimiento · Herrería": ["Soldaduras y reparaciones", "Rejas y portones", "Estructuras metálicas"],
    "Hogar y mantenimiento · Cerrajería": ["Apertura de puertas", "Cambio de cerraduras", "Copias de llaves (in situ)"],
    "Hogar y mantenimiento · Pintura": ["Pintura interior", "Pintura exterior", "Impermeabilizantes", "Texturados y efectos"],
    "Hogar y mantenimiento · Construcción en seco": ["Durlock tabiques", "Cielorrasos", "Aislamiento acústico"],
    "Hogar y mantenimiento · Impermeabilización": ["Membrana en terrazas", "Sellado de filtraciones"],
    "Hogar y mantenimiento · Jardinería": ["Corte de césped", "Poda de arbustos", "Parquizaciones"],
    "Hogar y mantenimiento · Parquización": ["Diseño de espacios verdes", "Colocación de césped"],
    "Hogar y mantenimiento · Riego automático": ["Instalación de riego por aspersión", "Mantenimiento de sistema de riego"],
    "Hogar y mantenimiento · Piscinas": ["Mantenimiento de piscinas", "Colocación de bombas y filtros"],
    "Hogar y mantenimiento · Control de plagas": ["Desinfección de cucarachas", "Desratización"],
    "Hogar y mantenimiento · Limpieza": ["Limpieza profunda de hogar", "Limpieza post-obra", "Limpieza de final de obra"],
    "Hogar y mantenimiento · Aire acondicionado": ["Instalación split", "Mantenimiento y recarga", "Reparación de aire acondicionado"],
    "Hogar y mantenimiento · Calefacción": ["Instalación de calefactores", "Revisión de calefacción"],
    "Hogar y mantenimiento · Electrodomésticos": ["Reparación de heladeras", "Reparación de lavarropas", "Reparación de microondas"],
    "Hogar y mantenimiento · Vidriería": ["Colocación de vidrios", "DVH y cerramientos"],
    "Hogar y mantenimiento · Techos y zinguería": ["Reparación de techos", "Colocación de canaletas"],
    "Hogar y mantenimiento · Yesería": ["Yeso en interiores", "Cielorrasos de yeso"],
    "Hogar y mantenimiento · Persianas y cortinas": ["Arreglo de persianas", "Colocación de cortinas"],
    "Hogar y mantenimiento · Pisos y revestimientos": ["Pisos flotantes", "Porcelanato"],
    "Hogar y mantenimiento · Domótica": ["Automatización de hogar", "Instalación smart home"],
    "Hogar y mantenimiento · Energía solar": ["Colocación de paneles solares", "Sistemas off-grid"],
    "Hogar y mantenimiento · Seguridad (CCTV y alarmas)": ["Instalación de cámaras", "Instalación de alarmas"],
    "Hogar y mantenimiento · Mudanzas y fletes": ["Flete por hora", "Mudanza completa"],
    "Hogar y mantenimiento · Tapicería": ["Retapizado de sillones", "Tapizado automotor"],

    // =========================
    // TECNOLOGÍA Y SOPORTE
    // =========================
    "Tecnología y soporte · Soporte técnico y Telefonía": [
      "Reparación de PC",
      "Reparación de notebook",
      "Optimización del sistema",
      "Instalación de software",
      "Backup y recuperación",
      "Reparación de smartphones",
      "Cambio de pantallas",
    ],
    "Tecnología y soporte · Redes y Telecomunicaciones": [
      "Cableado estructurado",
      "Configuración de routers",
      "Segmentación y VLAN",
      "Wi-Fi empresarial",
      "Firewall y routing",
      "Fibra óptica (fusiones y mediciones)",
    ],
    "Tecnología y soporte · Automatización e IoT": [
      "Sensores y automatismos",
      "PLC/SCADA básico",
      "Protocolos industriales",
      "Domótica avanzada",
    ],

    // =========================
    // DESARROLLO DE SOFTWARE
    // =========================
    "Desarrollo de software · Frontend": [
      "Maquetado responsivo",
      "SPAs con React/Vue",
      "Design System e implementación",
      "Accesibilidad (a11y) y performance",
    ],
    "Desarrollo de software · Backend": [
      "APIs REST/GraphQL",
      "Autenticación y autorización (JWT/OAuth2)",
      "Integración con pasarelas de pago",
      "Procesamiento en background y colas",
    ],
    "Desarrollo de software · Fullstack": [
      "MVP fullstack end-to-end",
      "Paneles de administración",
      "SSR/SSG (Next.js)",
      "Integración con terceros (Stripe, Firebase, Mapas)",
    ],
    "Desarrollo de software · Mobile": [
      "Apps híbridas (React Native/Flutter)",
      "Publicación en stores",
      "Integración push y deep links",
    ],
    "Desarrollo de software · Arquitectura": [
      "Diseño de arquitectura escalable",
      "Microservicios y eventos",
      "DDD/CQRS",
    ],
    "Desarrollo de software · QA/Testing": [
      "Testing E2E",
      "Testing unitario/integración",
      "Pruebas de performance",
    ],
    "Desarrollo de software · DevOps": [
      "Pipelines CI/CD",
      "Infraestructura como código (Terraform)",
      "Observabilidad y logging",
      "Contenedores y orquestación",
    ],
    "Desarrollo de software · Cloud": [
      "Arquitecturas en AWS/GCP/Azure",
      "Serverless",
      "Optimización de costos",
      "Seguridad y gobernanza",
    ],
    "Desarrollo de software · Bases de datos": [
      "Modelado relacional/noSQL",
      "Sharding/replicación",
      "Tuning de performance",
      "Backups y recuperación",
    ],
    "Desarrollo de software · Producto · UX/UI": [
      "Investigación con usuarios",
      "Wireframes y prototipos",
      "Usabilidad y accesibilidad",
      "Design System",
    ],
    "Desarrollo de software · Producto · Research": [
      "Entrevistas y test de usabilidad",
      "Benchmark competitivo",
      "Mapa de experiencia (Customer Journey)",
    ],
    "Desarrollo de software · Producto · Diseño visual": [
      "UI Kit y componentes",
      "Branding para productos",
      "Handoff a desarrollo",
    ],

    // =========================
    // INGENIERÍA DE DATOS
    // =========================
    "Ingeniería de datos · Data Engineering": [
      "Pipelines de datos (ETL/ELT)",
      "Ingesta batch/streaming",
      "Orquestación (Airflow/Prefect)",
      "Data Lakes y Warehouses",
    ],
    "Ingeniería de datos · Data Analytics y BI": [
      "Análisis exploratorio",
      "Modelado dimensional",
      "Dashboards (Power BI/Looker/Tableau)",
      "Data marts y métricas",
    ],
    "Ingeniería de datos · Data Science": [
      "Modelos de clasificación/regresión",
      "NLP/Computer Vision",
      "Experimentación y validación",
    ],
    "Ingeniería de datos · MLOps": [
      "Entrenamiento y despliegue de modelos",
      "Monitoreo de drift",
      "Feature stores",
      "Batch/online inference",
    ],
    "Ingeniería de datos · Gobernanza de datos": [
      "Catálogo y linaje",
      "Calidad y políticas",
      "Seguridad y acceso",
    ],

    // =========================
    // SEGURIDAD INFORMÁTICA
    // =========================
    "Seguridad informática · Blue Team": [
      "Monitoreo y respuesta a incidentes",
      "Hardening de servidores",
      "Gestión de vulnerabilidades",
      "SIEM/SOAR básico",
    ],
    "Seguridad informática · Red Team": [
      "Pentesting interno/externo",
      "Phishing y campañas controladas",
      "Explotación y reporte técnico",
    ],
    "Seguridad informática · GRC y Compliance": [
      "Políticas y normativas",
      "Gestión de riesgo",
      "ISO 27001 gap assessment",
    ],

    // =========================
    // INGENIERÍAS (clásicas)
    // =========================
    "Ingenierías · Civil": [
      "Cálculo estructural",
      "Dirección de obra civil",
      "Estructuras de hormigón y acero",
    ],
    "Ingenierías · Industrial": [
      "Optimización de procesos",
      "Layout y logística",
      "Lean/Seis Sigma",
    ],
    "Ingenierías · Química": [
      "Diseño de procesos",
      "Tratamiento de efluentes",
      "Buenas prácticas de manufactura (BPM)",
    ],
    "Ingenierías · Mecánica": [
      "Diseño mecánico CAD",
      "Mantenimiento predictivo",
      "HVAC industrial",
    ],
    "Ingenierías · Eléctrica": [
      "Tableros eléctricos",
      "Media y baja tensión",
      "Protecciones y selectividad",
    ],
    "Ingenierías · Electrónica": [
      "PCB y prototipado",
      "Instrumentación",
      "Sistemas embebidos",
    ],
    "Ingenierías · Sistemas": [
      "Análisis y diseño de sistemas",
      "Integraciones y middleware",
      "Gobierno de TI",
    ],
    "Ingenierías · Ambiental": [
      "Estudios de impacto",
      "Gestión de residuos",
      "ISO 14001",
    ],
    "Ingenierías · Higiene y Seguridad": [
      "Matriz de riesgos",
      "Capacitaciones H&S",
      "Plan de emergencias",
    ],
    "Ingenierías · Agronómica": [
      "Manejo de cultivos",
      "Riego y suelos",
      "Buenas prácticas agrícolas",
    ],
    "Ingenierías · Biomédica": [
      "Equipamiento médico",
      "Mantenimiento hospitalario",
      "Validación y calibración",
    ],
    "Ingenierías · Telecomunicaciones": [
      "Radioenlaces",
      "Redes móviles",
      "Fibra óptica avanzada",
    ],

    // =========================
    // AUTOMOTOR
    // =========================
    "Automotor · Mecánica": ["Service completo", "Frenos y embrague", "Cambio de correas"],
    "Automotor · Electricidad del automotor": ["Alternador y arranque", "Luces y cableado"],
    "Automotor · Chapa y pintura": ["Reparación de golpes", "Pintura parcial"],
    "Automotor · Gomería": ["Cambio de neumáticos", "Balanceo y alineación"],
    "Automotor · Detailing": ["Pulido y encerado", "Limpieza integral"],
    "Automotor · Lavado de autos": ["Lavado básico", "Lavado premium"],
    "Automotor · Auxilio mecánico": ["Remolque urbano", "Arranque de batería"],
    "Automotor · Audio y multimedia": ["Instalación de estéreo", "Cámaras traseras"],
    "Automotor · Aire acondicionado automotor": ["Carga de gas", "Reparación de compresor"],
    "Automotor · Tapizado automotor": ["Tapizado de butacas", "Volantes y paneles"],

    // =========================
    // PROFESIONALES Y NEGOCIOS
    // =========================
    "Profesionales y negocios · Contabilidad": ["Monotributo y autónomos", "Declaraciones juradas"],
    "Profesionales y negocios · Asesoría legal": ["Consulta legal", "Contratos y acuerdos"],
    "Profesionales y negocios · Recursos humanos": ["Reclutamiento y selección", "Payroll (básico)"],
    "Profesionales y negocios · Marketing": ["Publicidad en redes", "Estrategia digital"],
    "Profesionales y negocios · Diseño gráfico": ["Identidad visual", "Piezas para redes"],
    "Profesionales y negocios · Redacción y copywriting": ["Copy para anuncios", "Artículos de blog"],
    "Profesionales y negocios · Traducción": ["Traducción técnico-legal", "Traducción simple"],
    "Profesionales y negocios · Arquitectura": ["Planos y permisos", "Dirección de obra"],
    "Profesionales y negocios · Agrimensura": ["Mensuras y subdivisiones", "Relevamientos"],
    "Profesionales y negocios · Inmobiliaria": ["Tasaciones", "Administración de alquileres"],
    "Profesionales y negocios · Seguridad e higiene": ["Capacitaciones", "Matriz de riesgos"],
    "Profesionales y negocios · Producción audiovisual": ["Filmación de eventos", "Edición de video"],
    "Profesionales y negocios · Impresión y gráfica": ["Gran formato", "Merchandising"],
    "Profesionales y negocios · Community management": ["Gestión de redes", "Calendario de contenido"],
    "Profesionales y negocios · Fotografía": ["Sesión de fotos", "Cobertura de eventos"],
    "Profesionales y negocios · Filmación": ["Video de eventos", "Edición profesional"],
    "Profesionales y negocios · Gestoría y trámites": ["Gestoría automotor", "Habilitaciones municipales"],

    // =========================
    // SALUD / BIENESTAR / BELLEZA
    // =========================
    "Salud y bienestar · Salud": ["Médico clínico (consulta)", "Enfermería a domicilio"],
    "Salud y bienestar · Psicología": ["Psicoterapia individual", "Terapia de pareja"],
    "Salud y bienestar · Nutrición": ["Consulta nutricional", "Plan alimentario"],
    "Salud y bienestar · Kinesiología": ["Rehabilitación", "Kinesiología deportiva"],
    "Salud y bienestar · Fonoaudiología": ["Reeducación del habla", "Terapia deglución"],
    "Salud y bienestar · Odontología": ["Limpieza dental", "Arreglo de caries"],
    "Salud y bienestar · Enfermería": ["Curaciones", "Aplicación de inyecciones"],
    "Salud y bienestar · Bienestar": ["Spa de manos", "Rutinas de relajación"],
    "Salud y bienestar · Peluquería": ["Corte de cabello", "Color y reflejos"],
    "Salud y bienestar · Barbería": ["Corte y barba", "Afeitado clásico"],
    "Salud y bienestar · Maquillaje": ["Social y eventos", "Novias"],
    "Salud y bienestar · Depilación": ["Cera tradicional", "Depilación definitiva"],
    "Salud y bienestar · Uñas": ["Uñas esculpidas", "Semipermanente"],
    "Salud y bienestar · Cosmetología": ["Limpieza facial", "Tratamientos antiacné"],
    "Salud y bienestar · Masajes": ["Relajante", "Descontracturante"],
    "Salud y bienestar · Spa": ["Day spa", "Circuito húmedo"],
    "Salud y bienestar · Entrenamiento personal": ["Personal trainer", "Plan de entrenamiento"],
    "Salud y bienestar · Podología": ["Tratamiento de callos", "Uñas encarnadas"],

    // =========================
    // EDUCACIÓN / CAPACITACIÓN
    // =========================
    "Educación · Docente primaria": ["Clases de lengua (primaria)", "Clases de matemática (primaria)"],
    "Educación · Docente secundaria": ["Clases de matemática (secundaria)", "Clases de física (secundaria)"],
    "Educación · Docente universitaria": ["Apoyo en análisis matemático", "Apoyo en programación"],
    "Educación · Clases particulares": ["Apoyo escolar a domicilio", "Clases online"],
    "Educación · Idiomas": ["Clases de inglés", "Clases de portugués", "Clases de francés"],
    "Educación · Música": ["Clases de guitarra", "Clases de piano", "Canto"],
    "Educación · Programación": ["JavaScript desde cero", "React para principiantes"],
    "Educación · Apoyo escolar": ["Tareas y resúmenes", "Técnicas de estudio"],
    "Educación · Psicopedagogía": ["Evaluación psicopedagógica", "Acompañamiento escolar"],
    "Educación · Educación especial": ["Acompañante terapéutico", "Apoyos específicos"],
    "Educación · Orientación vocacional": ["Test y entrevistas", "Taller grupal"],

    // =========================
    // CUIDADO
    // =========================
    "Cuidado · Niñera": ["Cuidado de niños por hora", "Niñera nocturna"],
    "Cuidado · Cuidado de adultos mayores": ["Acompañamiento diurno", "Acompañamiento nocturno"],
    "Cuidado · Acompañante terapéutico": ["Apoyo domiciliario", "Asistencia en instituciones"],

    // =========================
    // MASCOTAS
    // =========================
    "Mascotas · Veterinaria": ["Vacunación", "Consulta clínica"],
    "Mascotas · Paseo de perros": ["Paseo individual", "Paseo grupal"],
    "Mascotas · Peluquería canina": ["Baño y corte", "Deslanado"],
    "Mascotas · Adiestramiento canino": ["Obediencia básica", "Modificación de conducta"],
    "Mascotas · Cuidado de mascotas": ["Petsitter a domicilio", "Guardería por día"],
    "Mascotas · Guardería canina": ["Guardería diurna", "Guardería nocturna"],

    // =========================
    // EVENTOS / GASTRONOMÍA
    // =========================
    "Eventos y gastronomía · Organización de eventos": ["Organizador integral", "Coordinador de evento"],
    "Eventos y gastronomía · Mozos y camareras": ["Servicio de mozos", "Armado y desmontaje"],
    "Eventos y gastronomía · Bartenders": ["Barra clásica", "Barra premium"],
    "Eventos y gastronomía · DJs": ["DJ social", "DJ corporativo"],
    "Eventos y gastronomía · Sonido e iluminación": ["Alquiler de sonido", "Iluminación para eventos"],
    "Eventos y gastronomía · Decoración de eventos": ["Decoración temática", "Globología y flores"],
    "Eventos y gastronomía · Alquiler de livings": ["Livings y gazebos", "Alquiler de vajilla"],
    "Eventos y gastronomía · Catering": ["Catering finger food", "Catering formal"],
    "Eventos y gastronomía · Chefs a domicilio": ["Chef para cenas", "Clases de cocina"],
    "Eventos y gastronomía · Pastelería": ["Tortas personalizadas", "Mesa dulce"],
    "Eventos y gastronomía · Food trucks": ["Food truck para eventos", "Street food"],
    "Eventos y gastronomía · Seguridad para eventos": ["Control de accesos", "Vigilancia"],
    "Eventos y gastronomía · Animación infantil": ["Animación con juegos", "Shows infantiles"],
    "Eventos y gastronomía · Wedding planner": ["Planificación integral", "Coordinación día del evento"],

    // =========================
    // LOGÍSTICA / TRANSPORTE
    // =========================
    "Logística y transporte · Mensajería y cadetería": ["Mensajería en moto", "Trámites y diligencias"],
    "Logística y transporte · Envíos y paquetería": ["Envío same-day", "Gestión de paquetes"],
    "Logística y transporte · Courier internacional": ["Puerta a puerta", "Despacho básico"],
    "Logística y transporte · Fletes": ["Flete chico", "Flete mediano"],
    "Logística y transporte · Mudanzas": ["Mudanza local", "Mudanza larga distancia"],
    "Logística y transporte · Traslados y chofer": ["Chofer particular", "Traslado aeropuerto"],
    "Logística y transporte · Cargas pesadas": ["Grúas y movimiento", "Logística industrial"],

    // =========================
    // INDUSTRIAL / AGRO
    // =========================
    "Industrial y agro · Soldadura industrial": ["Soldadura MIG/MAG/TIG", "Estructuras pesadas"],
    "Industrial y agro · Tornería y fresado": ["Piezas a medida", "Mantenimiento de precisión"],
    "Industrial y agro · Electricidad industrial": ["Tableros industriales", "Motores y variadores"],
    "Industrial y agro · Montajes industriales": ["Montaje de líneas", "Calderería básica"],
    "Industrial y agro · Refrigeración industrial": ["Cámaras frigoríficas", "Chillers"],
    "Industrial y agro · Seguridad industrial": ["Planes de seguridad", "Capacitaciones"],
    "Industrial y agro · Agricultura": ["Siembra y cosecha", "Aplicaciones"],
    "Industrial y agro · Riego agrícola": ["Instalación de pivots", "Goteo tecnificado"],
    "Industrial y agro · Maquinaria agrícola": ["Mantenimiento de tractores", "Reparación de implementos"],

    // =========================
    // TURISMO / OCIO
    // =========================
    "Turismo y ocio · Guía turístico": ["City tour", "Excursiones"],
    "Turismo y ocio · Traslados aeropuerto": ["Traslados privados", "Shuttle compartido"],
    "Turismo y ocio · Alquiler de vehículos": ["Alquiler con chofer", "Alquiler sin chofer"],
    "Turismo y ocio · Organización de viajes": ["Itinerarios a medida", "Reservas y asistencia"],

    // =========================
    // ARTE / MANUALIDADES
    // =========================
    "Arte y manualidades · Arte y pintura": ["Murales", "Cuadros personalizados"],
    "Arte y manualidades · Cerámica": ["Taller de cerámica", "Piezas por encargo"],
    "Arte y manualidades · Manualidades": ["Souvenirs personalizados", "Artesanías a medida"],
    "Arte y manualidades · Carpintería artística": ["Tallado en madera", "Restauración artística"],

    // Catch-all
    "Otras profesiones": ["Servicio personalizado", "Consulta a medida"],
  };

  // Generadores adicionales para Educación (materias, idiomas, música) – se mantienen
  const __primary = ["Lengua", "Matemática", "Ciencias naturales", "Ciencias sociales", "Inglés básico"];
  const __secondary = ["Matemática", "Física", "Química", "Biología", "Historia", "Geografía", "Lengua y literatura", "Filosofía", "Economía", "Informática"];
  const __university = ["Análisis matemático", "Álgebra", "Programación", "Bases de datos", "Estadística", "Física I", "Química general", "Contabilidad", "Marketing", "Derecho"];
  const __languages = ["Inglés", "Portugués", "Italiano", "Francés", "Alemán", "Chino"];
  const __instruments = ["Guitarra", "Piano", "Batería", "Bajo", "Violín", "Canto"];

  // -----------------------------------------------------------------------------
  // Construcción del arreglo de servicios
  // -----------------------------------------------------------------------------
  const services = [
    // --- Los que ya tenías (compatibilidad, 1 reasignado)
    { name: "Instalación eléctrica", description: "Instalaciones completas para hogares", price: 10000, categoryName: "Hogar y mantenimiento · Electricidad" },
    { name: "Reparación de enchufes", description: "Solución de cortocircuitos y enchufes quemados", price: 2500, categoryName: "Hogar y mantenimiento · Electricidad" },
    { name: "Reparación de caños", description: "Solución a fugas de agua y caños rotos", price: 3000, categoryName: "Hogar y mantenimiento · Plomería" },
    { name: "Destapación de cloacas", description: "Servicio urgente o programado", price: 4500, categoryName: "Hogar y mantenimiento · Plomería" },
    { name: "Instalación de gas", description: "Habilitado para trabajar con redes de gas", price: 12000, categoryName: "Hogar y mantenimiento · Gas" },
    { name: "Colocación de cerámicos", description: "Pisos y paredes", price: 7000, categoryName: "Hogar y mantenimiento · Albañilería" },
    { name: "Armado de muebles", description: "Armado de muebles a medida", price: 5000, categoryName: "Hogar y mantenimiento · Carpintería" },
    { name: "Limpieza profunda de hogar", description: "Desinfección completa", price: 6000, categoryName: "Hogar y mantenimiento · Limpieza" },
    { name: "Corte de cabello", description: "Cabello corto, largo, con estilo", price: 2000, categoryName: "Salud y bienestar · Peluquería" },
    { name: "Depilación definitiva", description: "Depilación láser", price: 8000, categoryName: "Salud y bienestar · Depilación" },
    { name: "Uñas esculpidas", description: "Diseño y esmaltado", price: 3500, categoryName: "Salud y bienestar · Uñas" },
    { name: "Masaje relajante", description: "Terapia descontracturante", price: 4000, categoryName: "Salud y bienestar · Masajes" },
    { name: "Psicoterapia individual", description: "Consulta online o presencial", price: 6000, categoryName: "Salud y bienestar · Psicología" },
    { name: "Coaching personal", description: "Sesiones motivacionales", price: 5000, categoryName: "Salud y bienestar · Salud" },
    { name: "Consulta nutricional", description: "Planes alimenticios personalizados", price: 4500, categoryName: "Salud y bienestar · Nutrición" },
    { name: "Vacunación de mascotas", description: "Perros y gatos", price: 2500, categoryName: "Mascotas · Veterinaria" },
    { name: "Cuidado de niños por hora", description: "Con experiencia y referencias", price: 2000, categoryName: "Cuidado · Niñera" },
    { name: "Acompañamiento de mayores", description: "Día o noche", price: 3500, categoryName: "Cuidado · Cuidado de adultos mayores" },
    // [CAMBIO] Este antes apuntaba a "Tecnología"
    { name: "Reparación de PC", description: "Formateo, limpieza, cambio de partes", price: 4500, categoryName: "Tecnología y soporte · Soporte técnico y Telefonía" },
    { name: "Sesión de fotos profesional", description: "Book personal o eventos", price: 10000, categoryName: "Profesionales y negocios · Fotografía" },
    { name: "Publicidad en redes sociales", description: "Campañas pagas y contenido", price: 9000, categoryName: "Profesionales y negocios · Marketing" },
    { name: "Declaración de impuestos", description: "Monotributo y autónomos", price: 8000, categoryName: "Profesionales y negocios · Contabilidad" },
    { name: "Consulta legal", description: "Civil, comercial o laboral", price: 7000, categoryName: "Profesionales y negocios · Asesoría legal" },

    // --- Masivo: expandimos por categoría
    ...Object.entries(__baseByCategory).flatMap(([categoryName, arr]) =>
      arr.map((n) => ({ name: n, description: "Servicio profesional", price: 5000, categoryName }))
    ),

    // --- Educación generada (se mantiene)
    ...__primary.map((s) => ({ name: `Clases de ${s} (primaria)`, description: "Clases personalizadas", price: 3000, categoryName: "Educación · Docente primaria" })),
    ...__secondary.map((s) => ({ name: `Clases de ${s} (secundaria)`, description: "Clases personalizadas", price: 3500, categoryName: "Educación · Docente secundaria" })),
    ...__university.map((s) => ({ name: `Apoyo en ${s} (universitario)`, description: "Clases personalizadas", price: 4000, categoryName: "Educación · Docente universitaria" })),
    ...__languages.map((l) => ({ name: `Clases de ${l}`, description: "Conversación y gramática", price: 3500, categoryName: "Educación · Idiomas" })),
    ...__instruments.map((i) => ({ name: `Clases de ${i}`, description: "Técnica e interpretación", price: 3500, categoryName: "Educación · Música" })),
  ]
    .map((service) => ({ ...service, name: capitalizeWords(service.name) }))
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
