// src/controllers/professional.controller.js
import mongoose from "mongoose";
import path from "path";
import fs from "fs";

import ProfessionalModel from "../models/Professional.js";
import ServiceModel from "../models/Service.js";
import isNowWithinSchedule from "../utils/schedule.js";
import { normalizePhone } from "../utils/phone.js";

/* Helpers */
function filterVerifiedWithUser(docs) {
  return (docs || []).filter((p) => p?.user && p.user?.verified === true);
}

const strip = (s = "") =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function canonicalDayKey(k = "") {
  const s = strip(k);
  if (s === "miercoles") return "miércoles";
  if (s === "sabado") return "sábado";
  return s;
}

function normalizeSchedule(scheduleLike = {}) {
  const obj =
    scheduleLike instanceof Map
      ? Object.fromEntries(scheduleLike)
      : scheduleLike || {};
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

function safeUnlinkByUrl(url = "") {
  try {
    if (!url) return;
    const rel = url.startsWith("/") ? url.slice(1) : url;
    const abs = path.resolve(process.cwd(), rel);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) {
    console.warn("safeUnlinkByUrl:", e.message);
  }
}

/* Constantes de negocio seña */
const DEPOSIT_MIN = 2000;
const DEPOSIT_MAX = 5000;

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

    pro.documents = pro.documents || {};
    pro.documents[key] = {};
    await pro.save();

    return res.json({ message: "Documento eliminado", documents: pro.documents });
  } catch (e) {
    console.error("deleteMyDocument error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

export const createProfessionalProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== "professional") {
      return res.status(403).json({ message: "Only professionals can create profiles" });
    }

    const {
      services,
      yearsOfExperience,
      bio,
      location,
      isAvailableNow,
      availabilitySchedule,
      phone,
      showPhone,
      address,
      // 🆕 seña
      depositEnabled,
      depositAmount,
      nationality,
      whatsapp,
      linkedinUrl,
    } = req.body;

    // Normalizar location
    let loc = location;
    if (loc && typeof loc === "object" && "lat" in loc && "lng" in loc) {
      loc = { type: "Point", coordinates: [Number(loc.lng), Number(loc.lat)] };
    }
    if (!loc || !Array.isArray(loc.coordinates) || loc.coordinates.length !== 2) {
      return res.status(400).json({ message: "Location (lng, lat) es obligatorio" });
    }

    // Validación de seña
    const patchDeposit = {};
    if (typeof depositEnabled === "boolean") patchDeposit.depositEnabled = depositEnabled;
    if (depositAmount != null) {
      const n = Math.round(Number(depositAmount));
      if (!Number.isFinite(n) || n < DEPOSIT_MIN || n > DEPOSIT_MAX) {
        return res.status(400).json({ message: `depositAmount debe estar entre ${DEPOSIT_MIN} y ${DEPOSIT_MAX}` });
      }
      patchDeposit.depositAmount = n;
    }

    // Normalización de whatsapp
    let whatsappNormalized = undefined;
    if (whatsapp && (whatsapp.number || whatsapp.visible != null)) {
      let countryGuess =
        (req.body?.nationality || address?.country || nationality || "").toString().toUpperCase();
      const out = { visible: !!whatsapp.visible };
      const raw = String(whatsapp.number || "").trim();
      if (raw) {
        const norm = normalizePhone(raw, countryGuess);
        if (!norm) return res.status(400).json({ message: "INVALID_WHATSAPP_NUMBER" });
        out.number = norm.e164;
        out.country = norm.country || countryGuess || "";
        out.nationalNumber = norm.nationalNumber || "";
      } else {
        out.number = "";
        out.country = "";
        out.nationalNumber = "";
        out.visible = false;
      }
      whatsappNormalized = out;
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
      nationality,
      ...(whatsappNormalized ? { whatsapp: whatsappNormalized } : {}),
      ...patchDeposit,
      ...(linkedinUrl != null ? { linkedinUrl: String(linkedinUrl).trim() } : {}),
    });

    const saved = await profile.save();
    return res.status(201).json(saved);
  } catch (error) {
    console.error("❌ Error al crear perfil:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

export const getProfessionals = async (req, res) => {
  try {
    const {
      serviceId,
      categoryId,
      availableNow,
      page = 1,
      limit = 12,
      // [CHANGE GP-CSV] admitir CSV/array de servicios en query (?services=a,b,c o services[]=a&services[]=b)
      services: servicesParam,
    } = req.query;

    const query = {};

    // [CHANGE GP-CSV] construir set de servicios filtrados
    let serviceIdsFilter = [];

    // soporta CSV string o array
    if (Array.isArray(servicesParam)) {
      serviceIdsFilter = servicesParam
        .map((s) => String(s).trim())
        .filter((s) => mongoose.Types.ObjectId.isValid(s));
    } else if (typeof servicesParam === "string" && servicesParam.trim()) {
      serviceIdsFilter = String(servicesParam)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => mongoose.Types.ObjectId.isValid(s));
    }

    if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
      serviceIdsFilter.push(serviceId);
    }

    // Si viene categoría, intersectamos con los servicios de esa categoría
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      const servicesInCategory = await ServiceModel.find({ category: categoryId }, "_id");
      const categoryIds = servicesInCategory.map((s) => s._id.toString());

      if (serviceIdsFilter.length) {
        const set = new Set(categoryIds);
        serviceIdsFilter = serviceIdsFilter.filter((id) => set.has(id));
        if (serviceIdsFilter.length === 0) {
          // CHANGES: log para auditoría
          console.log("[GET /professionals] services∩category => vacío");
          return res.json({ items: [], total: 0, page: 1, pages: 1 });
        }
      } else {
        serviceIdsFilter = categoryIds;
      }
    }

    if (serviceIdsFilter.length === 1) {
      query.services = serviceIdsFilter[0];
    } else if (serviceIdsFilter.length > 1) {
      query.services = { $in: serviceIdsFilter };
    }

    // En schedule (availableNow !== "true"), NO filtrar por disponibilidad
    if (String(availableNow) === "true") query.isAvailableNow = true;

    // CHANGES: log params y query armada
    console.log("[GET /professionals] params=%o query=%o", {
      serviceId, categoryId, availableNow, page, limit, servicesParam, serviceIdsFilter
    }, query);

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 12, 1), 50);

    const itemsRaw = await ProfessionalModel.find(query)
      .populate({
        path: "user",
        select: "name email phone verified avatarUrl",
        match: { verified: true },
      })
      .populate({
        path: "services",
        select: "name price category",
        populate: { path: "category", select: "name" },
      })
      .sort({ isAvailableNow: -1, updatedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const items = filterVerifiedWithUser(itemsRaw);
    const total = items.length;
    const pages = Math.max(Math.ceil(total / limitNum), 1);

    // CHANGES: log resultado
    console.log("[GET /professionals] result: items=%d page=%d pages=%d", total, pageNum, pages);

    return res.json({ items, total, page: pageNum, pages });
  } catch (error) {
    console.error("❌ Error al obtener profesionales:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getProfessionalById = async (req, res) => {
  try {
    const { id } = req.params;
    const professional = await ProfessionalModel.findById(id)
      .populate({
        path: "user",
        select: "name email verified avatarUrl",
        match: { verified: true },
      })
      .populate({
        path: "services",
        select: "name description price category",
        populate: { path: "category", select: "name" },
      });

    if (!professional || !professional.user) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json(professional);
  } catch (error) {
    console.error("❌ Error getting professional by ID:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getNearbyProfessionals = async (req, res) => {
  try {
    const {
      lat,
      lng,
      maxDistance = 5000,
      serviceId,
      categoryId,
      availableNow,
      // [CHANGE NEAR-CSV] admitir CSV/array de servicios en nearby (?services=a,b,c o services[]=a...)
      services: servicesParam,
    } = req.query;

    if (!lat || !lng)
      return res.status(400).json({ error: "Latitude and longitude are required" });

    const query = {};
    // En schedule (availableNow !== "true"), NO filtrar por disponibilidad
    if (String(availableNow) === "true") query.isAvailableNow = true;

    // [CHANGE NEAR-CSV] construir set de servicios filtrados
    let serviceIdsFilter = [];

    // soporta CSV string o array
    if (Array.isArray(servicesParam)) {
      serviceIdsFilter = servicesParam
        .map((s) => String(s).trim())
        .filter((s) => mongoose.Types.ObjectId.isValid(s));
    } else if (typeof servicesParam === "string" && servicesParam.trim()) {
      serviceIdsFilter = String(servicesParam)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => mongoose.Types.ObjectId.isValid(s));
    }

    if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
      serviceIdsFilter.push(serviceId);
    }

    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      const sIds = await ServiceModel.find({ category: categoryId }, "_id").then((x) =>
        x.map((s) => s._id.toString())
      );
      if (serviceIdsFilter.length) {
        const set = new Set(sIds);
        serviceIdsFilter = serviceIdsFilter.filter((id) => set.has(id));
        if (serviceIdsFilter.length === 0) {
          // CHANGES: log para auditoría
          console.log("[GET /professionals/nearby] services∩category => vacío");
          return res.json([]);
        }
      } else {
        serviceIdsFilter = sIds;
      }
    }

    if (serviceIdsFilter.length === 1) {
      query.services = serviceIdsFilter[0];
    } else if (serviceIdsFilter.length > 1) {
      query.services = { $in: serviceIdsFilter };
    }

    // CHANGES: log params y query previa a $near
    console.log("[GET /professionals/nearby] params=%o query=%o", {
      lat, lng, maxDistance, serviceId, categoryId, availableNow, servicesParam, serviceIdsFilter
    }, query);

    const raw = await ProfessionalModel.find({
      ...query,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(maxDistance, 10),
        },
      },
    })
      .populate({
        path: "user",
        select: "name email verified avatarUrl",
        match: { verified: true },
      })
      .populate({
        path: "services",
        select: "name price category",
        populate: { path: "category", select: "name" },
      });

    const pros = filterVerifiedWithUser(raw);

    // CHANGES: log cantidad devuelta
    console.log("[GET /professionals/nearby] result: count=%d", pros.length);

    res.json(pros);
  } catch (err) {
    console.error("nearby error", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const updateAvailabilityNow = async (req, res) => {
  try {
    const userId = req.user.id;
    const { isAvailableNow } = req.body;
    if (typeof isAvailableNow !== "boolean") {
      return res.status(400).json({ message: "Field 'isAvailableNow' must be a boolean" });
    }

    const before = await ProfessionalModel.findOne(
      { user: userId }, { availabilityStrategy:1, isAvailableNow:1, onlineSince:1, lastActivityAt:1 }
    ).lean();
    console.log("[AVAIL PATCH BEFORE]", userId, before);

    const setPatch = {
      isAvailableNow,
      lastActivityAt: new Date(),
      onlineSince: isAvailableNow ? new Date() : null,
    };

    // ⚖️ Si el usuario estaba en 'schedule', NO cambiamos la estrategia.
    // Sólo pasamos a 'manual' si antes no era 'schedule'.
    if (!before || before.availabilityStrategy !== "schedule") {
      setPatch.availabilityStrategy = "manual";
    }

    const updated = await ProfessionalModel.findOneAndUpdate(
      { user: userId },
      { $set: setPatch },
      { new: true }
    ).populate({ path: "user", select: "verified", match: { verified: true } });

    if (!updated || !updated.user) {
      return res.status(404).json({ message: "Professional profile not found" });
    }

    console.log("[AVAIL PATCH OK] userId=%s now=%o", userId, {
      isAvailableNow: updated.isAvailableNow,
      onlineSince: updated.onlineSince,
      lastActivityAt: updated.lastActivityAt,
      availabilityStrategy: updated.availabilityStrategy,
    });

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

export const getAvailableNowProfessionals = async (_req, res) => {
  try {
    const raw = await ProfessionalModel.find({ isAvailableNow: true })
      .populate({
        path: "user",
        select: "name email phone verified avatarUrl",
        match: { verified: true },
      })
      .populate({
        path: "services",
        select: "name price category",
        populate: { path: "category", select: "name" },
      })
      .sort({ updatedAt: -1 });

    const professionals = filterVerifiedWithUser(raw);
    const ids = professionals.map(p => p.user?._id?.toString()).filter(Boolean);
    console.log("[GET available-now] count=%d users=%j", ids.length, ids);
    res.json(professionals);
  } catch (error) {
    console.error("❌ Error getting available professionals:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const updateAvailabilitySchedule = async (req, res) => {
  try {
    const userId = req.user.id;
    const raw = req.body?.availabilitySchedule;
    if (!raw || typeof raw !== "object") {
      return res.status(400).json({ error: "Invalid availabilitySchedule" });
    }

    const re = /^\d{2}:\d{2}$/;
    for (const [day, slot] of Object.entries(raw)) {
      if (!slot?.from || !slot?.to || !re.test(slot.from) || !re.test(slot.to)) {
        return res.status(400).json({ error: `Bad time range for '${day}'` });
      }
    }

    const schedule = normalizeSchedule(raw);
    const shouldBeOn = isNowWithinSchedule(schedule);

    let saved = await ProfessionalModel.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          availabilitySchedule: schedule,
          availabilityStrategy: "schedule",
          isAvailableNow: shouldBeOn,
        },
      },
      { new: true, runValidators: true }
    );

    if (!saved) {
      return res.status(404).json({ error: "Professional profile not found" });
    }

    const plain =
      saved.availabilitySchedule instanceof Map
        ? Object.fromEntries(saved.availabilitySchedule)
        : saved.availabilitySchedule || {};

    const io = req.app.get("io");
    const payload = { userId: saved.user.toString(), isAvailableNow: saved.isAvailableNow, at: new Date().toISOString() };
    io?.emit("availability:update", payload);
    io?.to(payload.userId).emit("availability:self", payload);

    return res.json({
      message: "Availability updated",
      availabilitySchedule: plain,
      availabilityStrategy: saved.availabilityStrategy,
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
    const doc = await ProfessionalModel.findOne({ user: userId }).populate({
      path: "user",
      select: "name email verified avatarUrl",
      match: { verified: true },
    });

    if (!doc || !doc.user) return res.json({ exists: false });
    res.json(doc);
  } catch (e) {
    console.error("getMyProfessional error", e);
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
    ).populate({
      path: "user",
      select: "verified avatarUrl",
      match: { verified: true },
    });

    if (!updated || !updated.user) {
      return res.status(404).json({ message: "Professional profile not found" });
    }
    res.json({
      message: "Mode updated",
      availabilityStrategy: updated.availabilityStrategy,
    });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateMyLocation = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { lat, lng } = req.body;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ error: "lat/lng numéricos requeridos" });
    }

    const pro = await ProfessionalModel.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          location: { type: "Point", coordinates: [lng, lat] },
          lastLocationAt: new Date(),
        },
      },
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

    return res.json({ message: "Documento actualizado", documents: pro.documents });
  } catch (e) {
    console.error("uploadMyDocument error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getDocsMeta = async (req, res) => {
  try {
    const pro = await ProfessionalModel.findById(req.params.id).populate({
      path: "user",
      select: "verified",
      match: { verified: true },
    });
    if (!pro || !pro.user) return res.status(404).json({ message: "Not found" });

    const now = Date.now();
    const cr = pro.documents?.criminalRecord || null;
    const lic = pro.documents?.license || null;

    const clean = (d) =>
      d
        ? {
            url: d.url || "",
            fileName: d.fileName || "",
            uploadedAt: d.uploadedAt,
            expiresAt: d.expiresAt,
            status: d.status || "pending",
            expired: d.expiresAt ? new Date(d.expiresAt).getTime() < now : false,
          }
        : null;

    res.json({ criminalRecord: clean(cr), license: clean(lic) });
  } catch (e) {
    console.error("getDocsMeta error:", e);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateMyProfessional = async (req, res) => {
  try {
    const userId = req.user.id;
    const current = await ProfessionalModel.findOne({ user: userId });
    if (!current) return res.status(404).json({ message: "Professional profile not found" });

    const allowed = [
      "bio","phone","showPhone","services","nationality",
      "whatsapp.number","whatsapp.visible",
      "address.country","address.state","address.city","address.street","address.number","address.unit","address.postalCode","address.label","address.location",
      // depósito
      "depositEnabled","depositAmount",
      // payout (permitimos update también por /me genérico)
      "payout.holderName","payout.docType","payout.docNumber","payout.bankName","payout.cbu","payout.alias",
      "linkedinUrl",
    ];

    const payload = {};
    for (const k of allowed) {
      const [a,b,c] = k.split(".");
      if (b && c) {
        if (!payload[a]) payload[a] = {};
        if (!payload[a][b]) payload[a][b] = {};
        if (req.body?.[a]?.[b]?.[c] != null) payload[a][b][c] = req.body[a][b][c];
      } else if (b) {
        if (!payload[a]) payload[a] = {};
        if (req.body?.[a]?.[b] != null) payload[a][b] = req.body[a][b];
      } else if (req.body?.[a] != null) {
        payload[a] = req.body[a];
      }
    }

    if (typeof payload.nationality === "string") {
      payload.nationality = payload.nationality.toUpperCase();
    }
    if ("depositEnabled" in payload) payload.depositEnabled = !!payload.depositEnabled;
    if ("depositAmount" in payload) {
      const n = Number(payload.depositAmount);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ message: "depositAmount inválido" });
      payload.depositAmount = Math.round(n);
    }

    // ▶️ LINKEDIN: sanitizar string
    if (typeof payload.linkedinUrl === "string") {
      payload.linkedinUrl = payload.linkedinUrl.trim();
    }

    // Normalización básica de payout
    if (payload.payout) {
      if (typeof payload.payout.alias === "string") {
        payload.payout.alias = payload.payout.alias.trim().toLowerCase();
      }
      if (typeof payload.payout.cbu === "string") {
        payload.payout.cbu = payload.payout.cbu.replace(/\D/g, "");
      }
    }

    const updated = await ProfessionalModel.findOneAndUpdate(
      { user: userId },
      { $set: payload },
      { new: true, runValidators: true }
    ).populate({ path: "user", select: "name email verified", match: { verified: true } });

    if (!updated || !updated.user) return res.status(404).json({ message: "Professional profile not found" });

    res.json({ message: "Professional updated", professional: updated });
  } catch (e) {
    console.error("updateMyProfessional error", e);
    res.status(500).json({ message: "Server error" });
  }
};

/* NUEVO: endpoints dedicados a payout (opcionales, más acotados) */
export const getMyPayout = async (req, res) => {
  try {
    const userId = req.user.id;
    const pro = await ProfessionalModel.findOne({ user: userId }).select("payout");
    if (!pro) return res.status(404).json({ message: "Professional profile not found" });
    res.json(pro.payout || {});
  } catch (e) {
    console.error("getMyPayout error", e);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateMyPayout = async (req, res) => {
  try {
    const userId = req.user.id;
    const p = req.body?.payout || {};
    if (!p || typeof p !== "object") return res.status(400).json({ message: "payout requerido" });

    const patch = {
      "payout.holderName": p.holderName,
      "payout.docType": p.docType,
      "payout.docNumber": p.docNumber,
      "payout.bankName": p.bankName,
      "payout.cbu": (p.cbu || "").toString().replace(/\D/g, ""),
      "payout.alias": (p.alias || "").toString().trim().toLowerCase(),
    };

    const updated = await ProfessionalModel.findOneAndUpdate(
      { user: userId },
      { $set: patch },
      { new: true, runValidators: true }
    ).select("payout");

    if (!updated) return res.status(404).json({ message: "Professional profile not found" });
    res.json({ message: "Payout updated", payout: updated.payout });
  } catch (e) {
    console.error("updateMyPayout error", e);
    res.status(500).json({ message: "Server error" });
  }
};

/*
[CAMBIOS HECHOS AQUÍ]
- getProfessionals: ahora acepta `services` como CSV o array además de `serviceId` y lo cruza con `categoryId` si llega. [CHANGE GP-CSV]
- getNearbyProfessionals: igual que arriba, acepta `services` CSV/array + `serviceId` y mantiene consulta geoespacial con $near. [CHANGE NEAR-CSV]
- En ambos: agregué logs `console.log` (// CHANGES) para corroborar filtros recibidos y tamaño de resultados.
- En schedule (availableNow !== "true"), NO filtrar por disponibilidad (se retorna el set filtrado por área/ubicación).
*/
