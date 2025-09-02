// src/controllers/professional.controller.js
import mongoose from "mongoose";
import ProfessionalModel from "../models/Professional.js";
import ServiceModel from "../models/Service.js";
import isNowWithinSchedule from "../utils/schedule.js";
import path from "path";
import fs from "fs"; // <- faltaba para safeUnlinkByUrl
import { normalizePhone } from "../utils/phone.js";

/* Helpers: siempre devolver SOLO profesionales con user existente y verificado */
function filterVerifiedWithUser(docs) {
  return (docs || []).filter((p) => p?.user && p.user?.verified === true);
}

/* ───────────────────── Normalización de claves de días ───────────────────── */
const strip = (s = "") => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function canonicalDayKey(k = "") {
  const s = strip(k);
  if (s === "miercoles") return "miércoles";
  if (s === "sabado") return "sábado";
  return s; // domingo,lunes,martes,jueves,viernes ya coinciden
}
function normalizeSchedule(scheduleLike = {}) {
  // admite objeto o Map (por si viene de Mongoose)
  const obj = scheduleLike instanceof Map ? Object.fromEntries(scheduleLike) : scheduleLike || {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const canon = canonicalDayKey(k);
    if (!canon) continue;
    if (v && typeof v === "object" && v.from && v.to) {
      out[canon] = { from: String(v.from).trim(), to: String(v.to).trim() };
    }
  }
  return out;
}

function docKeyFromType(type) {
  if (type === "criminal-record") return "criminalRecord";
  if (type === "license") return "license";
  return null;
}

// helper seguro para borrar archivo local si existe
function safeUnlinkByUrl(url = "") {
  try {
    if (!url) return;
    // url viene como "/uploads/docs/<userId>/<file.pdf>"
    const rel = url.startsWith("/") ? url.slice(1) : url; // quito la barra
    const abs = path.resolve(process.cwd(), rel);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) {
    console.warn("safeUnlinkByUrl:", e.message);
  }
}

/** DELETE /api/professionals/me/docs/:type */
export const deleteMyDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const type = req.params.type;
    const key = docKeyFromType(type);
    if (!key) return res.status(400).json({ message: "Tipo de documento inválido" });

    const pro = await ProfessionalModel.findOne({ user: userId });
    if (!pro) return res.status(404).json({ message: "Professional profile not found" });

    const prev = pro.documents?.[key] || null;
    if (prev?.url) safeUnlinkByUrl(prev.url);

    // limpiar el campo (dejar objeto vacío para no romper schema)
    pro.documents = pro.documents || {};
    pro.documents[key] = {}; // limpio metadatos
    await pro.save();

    return res.json({ message: "Documento eliminado", documents: pro.documents });
  } catch (e) {
    console.error("deleteMyDocument error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

/* Crear perfil profesional */
export const createProfessionalProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== "professional") {
      return res.status(403).json({ message: "Only professionals can create profiles" });
    }

    const {
      services, yearsOfExperience, bio,
      location, isAvailableNow, availabilitySchedule,
      phone, showPhone, address,
    } = req.body;

    const existing = await ProfessionalModel.findOne({ user: userId });
    if (existing) return res.status(400).json({ message: "Professional profile already exists" });

    // normalizar location {lat,lng} → GeoJSON
    let loc = location;
    if (loc && typeof loc === "object" && "lat" in loc && "lng" in loc) {
      loc = { type: "Point", coordinates: [Number(loc.lng), Number(loc.lat)] };
    }
    if (!loc || !Array.isArray(loc.coordinates) || loc.coordinates.length !== 2) {
      return res.status(400).json({ message: "Location (lng, lat) es obligatorio" });
    }

    const profile = new ProfessionalModel({
      user: userId,
      services,
      yearsOfExperience,
      bio,
      location: loc,
      isAvailableNow,
      availabilitySchedule,
      phone,
      showPhone,
      address,
    });

    const saved = await profile.save();
    return res.status(201).json(saved);
  } catch (error) {
    console.error("❌ Error al crear perfil:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

/* Listado con filtros + paginación */
export const getProfessionals = async (req, res) => {
  try {
    const { serviceId, categoryId, availableNow, page = 1, limit = 12 } = req.query;

    const query = {};

    if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
      query.services = serviceId;
    }

    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      const servicesInCategory = await ServiceModel.find({ category: categoryId }, "_id");
      const ids = servicesInCategory.map((s) => s._id);
      if (ids.length) query.services = { $in: ids };
      else return res.json({ items: [], total: 0, page: 1, pages: 1 });
    }

    if (String(availableNow) === "true") {
      query.isAvailableNow = true;
    }

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 12, 1), 50);

    const [itemsRaw] = await Promise.all([
      ProfessionalModel.find(query)
        .populate({ path: "user", select: "name email phone verified avatarUrl", match: { verified: true } })
        .populate({ path: "services", select: "name price category", populate: { path: "category", select: "name" } })
        .sort({ isAvailableNow: -1, updatedAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
    ]);

    const items = filterVerifiedWithUser(itemsRaw);
    const total = items.length;
    const pages = Math.max(Math.ceil(total / limitNum), 1);

    return res.json({ items, total, page: pageNum, pages });
  } catch (error) {
    console.error("❌ Error al obtener profesionales:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

/* Obtener por ID */
export const getProfessionalById = async (req, res) => {
  try {
    const { id } = req.params;
    const professional = await ProfessionalModel.findById(id)
      .populate({ path: "user", select: "name email verified avatarUrl", match: { verified: true } })
      .populate({ path: "services", select: "name description price category", populate: { path: "category", select: "name" } });

    if (!professional || !professional.user) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json(professional);
  } catch (error) {
    console.error("❌ Error getting professional by ID:", error);
    res.status(500).json({ error: "Server error" });
  }
};

/* Cercanos por radio + filtros */
export const getNearbyProfessionals = async (req, res) => {
  try {
    const { lat, lng, maxDistance = 5000, serviceId, categoryId, availableNow } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: "Latitude and longitude are required" });

    const query = {};
    if (String(availableNow) === "true") query.isAvailableNow = true;

    if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
      query.services = serviceId;
    }

    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      const sIds = await ServiceModel.find({ category: categoryId }, "_id").then(x => x.map(s => s._id));
      query.services = sIds.length ? { $in: sIds } : "__EMPTY__";
    }
    if (query.services === "__EMPTY__") return res.json([]);

    const raw = await ProfessionalModel.find({
      ...query,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(maxDistance, 10),
        },
      },
    })
      .populate({ path: "user", select: "name email verified avatarUrl", match: { verified: true } })
      .populate({ path: "services", select: "name price category", populate: { path: "category", select: "name" } });

    const pros = filterVerifiedWithUser(raw);
    res.json(pros);
  } catch (err) {
    console.error("nearby error", err);
    res.status(500).json({ error: "Server error" });
  }
};

/* Disponibilidad NOW (manual override temporal) — NO cambia strategy */
export const updateAvailabilityNow = async (req, res) => {
  try {
    const userId = req.user.id;
    const { isAvailableNow } = req.body;

    if (typeof isAvailableNow !== "boolean") {
      return res.status(400).json({ message: "Field 'isAvailableNow' must be a boolean" });
    }

    const updated = await ProfessionalModel.findOneAndUpdate(
      { user: userId },
      { $set: { isAvailableNow } }, // 👈 NO tocamos availabilityStrategy
      { new: true }
    ).populate({ path: "user", select: "verified", match: { verified: true } });

    if (!updated || !updated.user) {
      return res.status(404).json({ message: "Professional profile not found" });
    }

    const io = req.app.get("io");
    io?.emit("availability:update", {
      userId: updated.user._id.toString(),
      isAvailableNow: updated.isAvailableNow,
      at: new Date().toISOString(),
    });

    res.json({
      message: "Availability updated",
      isAvailableNow: updated.isAvailableNow,
      availabilityStrategy: updated.availabilityStrategy,
    });
  } catch (error) {
    console.error("❌ Error updating availability:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* Lista de disponibles ahora */
export const getAvailableNowProfessionals = async (_req, res) => {
  try {
    const raw = await ProfessionalModel.find({ isAvailableNow: true })
      .populate({ path: "user", select: "name email phone verified avatarUrl", match: { verified: true } })
      .populate({ path: "services", select: "name price category", populate: { path: "category", select: "name" } })
      .sort({ updatedAt: -1 });

    const professionals = filterVerifiedWithUser(raw);
    res.json(professionals);
  } catch (error) {
    console.error("❌ Error getting available professionals:", error);
    res.status(500).json({ error: "Server error" });
  }
};

/* Agenda semanal */
export const updateAvailabilitySchedule = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1) Validación básica
    const raw = req.body?.availabilitySchedule;
    if (!raw || typeof raw !== "object") {
      return res.status(400).json({ error: "Invalid availabilitySchedule" });
    }

    // (opcional) validar formato HH:MM
    const re = /^\d{2}:\d{2}$/;
    for (const [day, slot] of Object.entries(raw)) {
      if (!slot?.from || !slot?.to || !re.test(slot.from) || !re.test(slot.to)) {
        return res.status(400).json({ error: `Bad time range for '${day}'` });
      }
    }

    // 2) Normalizar claves (miercoles→miércoles, sabado→sábado, etc.)
    const schedule = normalizeSchedule(raw);

    // 3) Calcular estado actual según agenda
    const shouldBeOn = isNowWithinSchedule(schedule);

    // 4) Guardar: agenda + strategy schedule + sincronizar isAvailableNow
    let saved = await ProfessionalModel.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          availabilitySchedule: schedule,
          availabilityStrategy: "schedule",
          isAvailableNow: shouldBeOn,
        },
      },
      { new: true }
    );

    if (!saved) {
      return res.status(404).json({ error: "Professional profile not found" });
    }

    // 5) Responder con POJO de agenda (por si Mongoose la guarda como Map)
    const plain =
      saved.availabilitySchedule instanceof Map
        ? Object.fromEntries(saved.availabilitySchedule)
        : (saved.availabilitySchedule || {});

    // 6) Notificar al FE
    const io = req.app.get("io");
    io?.emit("availability:update", {
      userId: saved.user.toString(),
      isAvailableNow: saved.isAvailableNow,
      at: new Date().toISOString(),
    });

    return res.json({
      message: "Availability updated",
      availabilitySchedule: plain,
      availabilityStrategy: saved.availabilityStrategy, // "schedule"
      isAvailableNow: saved.isAvailableNow,
    });
  } catch (error) {
    console.error("❌ Error updating availabilitySchedule:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

/* Mi perfil profesional */
export const getMyProfessional = async (req, res) => {
  try {
    const userId = req.user.id;
    const doc = await ProfessionalModel.findOne({ user: userId })
      .populate({ path: "user", select: "name email verified avatarUrl", match: { verified: true } });

    if (!doc || !doc.user) {
      // 200 sin _id -> el FE ya evalúa !!mine?._id como false
      return res.json({ exists: false });
    }
    res.json(doc);
  } catch (e) {
    console.error("getMyProfessional error", e);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateMyProfessional = async (req, res) => {
  try {
    const userId = req.user.id;

    // Leemos doc actual para fallback de región
    const current = await ProfessionalModel.findOne({ user: userId });
    if (!current) return res.status(404).json({ message: "Professional profile not found" });

    const allowed = [
      "bio", "phone", "showPhone", "services",
      "nationality",
      "whatsapp.number", "whatsapp.visible",
      "address.country","address.state","address.city","address.street","address.number","address.unit","address.postalCode",
      "address.label","address.location",
    ];

    const payload = {};
    for (const k of allowed) {
      const [root, sub, sub2] = k.split(".");
      if (sub && sub2) {
        if (!payload[root]) payload[root] = {};
        if (!payload[root][sub]) payload[root][sub] = {};
        if (req.body?.[root]?.[sub]?.[sub2] != null) payload[root][sub][sub2] = req.body[root][sub][sub2];
      } else if (sub) {
        if (!payload[root]) payload[root] = {};
        if (req.body?.[root]?.[sub] != null) payload[root][sub] = req.body[root][sub];
      } else if (req.body?.[root] != null) {
        payload[root] = req.body[root];
      }
    }

    // Normalizamos nationality
    if (typeof payload.nationality === "string") {
      payload.nationality = payload.nationality.toUpperCase();
    }

    // WhatsApp
    if (payload.whatsapp && (("number" in payload.whatsapp) || ("visible" in payload.whatsapp))) {
      const regionFallback =
        (payload.nationality ||
          payload?.address?.country ||
          current?.nationality ||
          current?.address?.country ||
          ""
        ).toString().toUpperCase();

      if ("number" in payload.whatsapp) {
        const raw = String(payload.whatsapp.number || "").trim();
        if (raw) {
          const norm = normalizePhone(raw, regionFallback);
          if (!norm) {
            return res.status(400).json({ message: "INVALID_WHATSAPP_NUMBER" });
          }
          payload.whatsapp.number = norm.e164;
          payload.whatsapp.country = norm.country || regionFallback || "";
          payload.whatsapp.nationalNumber = norm.nationalNumber || "";
        } else {
          payload.whatsapp.number = "";
          payload.whatsapp.country = "";
          payload.whatsapp.nationalNumber = "";
          if (!("visible" in payload.whatsapp)) payload.whatsapp.visible = false;
        }
      }
    }

    const updated = await ProfessionalModel.findOneAndUpdate(
      { user: userId },
      { $set: payload },
      { new: true }
    ).populate({ path: "user", select: "name email verified", match: { verified: true } });

    if (!updated || !updated.user) {
      return res.status(404).json({ message: "Professional profile not found" });
    }

    res.json({ message: "Professional updated", professional: updated });
  } catch (e) {
    console.error("updateMyProfessional error", e);
    res.status(500).json({ message: "Server error" });
  }
};

export const setAvailabilityMode = async (req, res) => {
  try {
    const userId = req.user.id;
    const { mode } = req.body; // "manual" | "schedule"
    if (!["manual", "schedule"].includes(mode)) {
      return res.status(400).json({ message: "Invalid mode" });
    }
    const updated = await ProfessionalModel.findOneAndUpdate(
      { user: userId },
      { $set: { availabilityStrategy: mode } },
      { new: true }
    ).populate({ path: "user", select: "verified avatarUrl", match: { verified: true } });

    if (!updated || !updated.user) {
      return res.status(404).json({ message: "Professional profile not found" });
    }
    res.json({ message: "Mode updated", availabilityStrategy: updated.availabilityStrategy });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
};

/* PRO actualiza su posición (en tiempo real) */
export const updateMyLocation = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { lat, lng } = req.body;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ error: "lat/lng numéricos requeridos" });
    }

    const pro = await ProfessionalModel.findOneAndUpdate(
      { user: userId },
      { $set: { location: { type: "Point", coordinates: [lng, lat] }, lastLocationAt: new Date() } },
      { new: true }
    ).populate({ path: "user", select: "verified", match: { verified: true } });

    if (!pro || !pro.user) {
      return res.status(404).json({ error: "Professional profile not found" });
    }

    const io = req.app.get("io");
    io.emit("pro:location:update", {
      userId,
      lat,
      lng,
      at: new Date().toISOString(),
      isAvailableNow: pro?.isAvailableNow ?? false,
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("updateMyLocation error", e);
    res.status(500).json({ error: "Server error" });
  }
};

/** POST /api/professionals/me/docs/:type  (type: criminal-record | license)  multipart: file */
export const uploadMyDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const type = req.params.type;
    const key = docKeyFromType(type);
    if (!key) return res.status(400).json({ message: "Tipo de documento inválido" });
    if (!req.file) return res.status(400).json({ message: "Archivo requerido (PDF)" });

    const pro = await ProfessionalModel.findOne({ user: userId });
    if (!pro) return res.status(404).json({ message: "Professional profile not found" });

    const rel = path.posix.join("/uploads", "docs", String(userId), req.file.filename);
    const uploadedAt = new Date();
    const meta = {
      url: rel,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedAt,
      status: "pending",
    };
    if (key === "criminalRecord") {
      const sixMonths = 1000 * 60 * 60 * 24 * 30 * 6;
      meta.expiresAt = new Date(uploadedAt.getTime() + sixMonths);
    }

    pro.documents = pro.documents || {};
    pro.documents[key] = { ...(pro.documents[key] || {}), ...meta };
    await pro.save();

    return res.json({
      message: "Documento actualizado",
      documents: pro.documents,
    });
  } catch (e) {
    console.error("uploadMyDocument error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

/** GET /api/professionals/:id/docs/meta */
export const getDocsMeta = async (req, res) => {
  try {
    const pro = await ProfessionalModel.findById(req.params.id)
      .populate({ path: "user", select: "verified", match: { verified: true } });
    if (!pro || !pro.user) return res.status(404).json({ message: "Not found" });

    const now = Date.now();
    const cr = pro.documents?.criminalRecord || null;
    const lic = pro.documents?.license || null;

    const clean = (d) => d ? ({
      url: d.url || "",
      fileName: d.fileName || "",
      uploadedAt: d.uploadedAt,
      expiresAt: d.expiresAt,
      status: d.status || "pending",
      expired: d.expiresAt ? new Date(d.expiresAt).getTime() < now : false,
    }) : null;

    res.json({
      criminalRecord: clean(cr),
      license: clean(lic),
    });
  } catch (e) {
    console.error("getDocsMeta error:", e);
    res.status(500).json({ message: "Server error" });
  }
};
