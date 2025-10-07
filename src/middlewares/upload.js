import multer from "multer";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve("uploads");
const MAX_AVATAR_MB = Number(process.env.MAX_AVATAR_MB || 3);
const MAX_DOC_MB = Number(process.env.MAX_DOC_MB || 15);

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

ensureDir(UPLOAD_DIR);
ensureDir(path.join(UPLOAD_DIR, "avatars"));
ensureDir(path.join(UPLOAD_DIR, "docs"));

function safeName(originalname) {
  const ext = path.extname(originalname).toLowerCase();
  const base = path
    .basename(originalname, ext)
    .toLowerCase()
    .replace(/[^a-z0-9\-_.]+/g, "-")
    .slice(0, 80);
  return `${Date.now()}_${base}${ext}`;
}

/* ------------------ AVATARES ------------------ */
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(UPLOAD_DIR, "avatars")),
  filename: (_req, file, cb) => cb(null, safeName(file.originalname)),
});

// 🔧 CAMBIO: aceptar image/jpg además de image/jpeg | png | webp
function avatarFilter(_req, file, cb) {
  let t = String(file.mimetype || "").toLowerCase();
  if (t === "image/jpg") t = "image/jpeg"; // normalizo jpg -> jpeg

  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  const ok = allowed.has(t);

  if (!ok) return cb(new Error("Solo imágenes JPG/PNG/WEBP"), false);
  cb(null, true);
}

export const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: avatarFilter,
  limits: { fileSize: MAX_AVATAR_MB * 1024 * 1024 },
}).single("file");

/* ------------------ DOCUMENTOS (PDF) ------------------ */
const docsStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const proId = req?.user?.id || "common";
    const dest = path.join(UPLOAD_DIR, "docs", String(proId));
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (_req, file, cb) => cb(null, safeName(file.originalname)),
});

function pdfFilter(_req, file, cb) {
  const ok = String(file.mimetype || "").toLowerCase() === "application/pdf";
  if (!ok) return cb(new Error("Solo PDF"), false);
  cb(null, true);
}

export const uploadDoc = multer({
  storage: docsStorage,
  fileFilter: pdfFilter,
  limits: { fileSize: MAX_DOC_MB * 1024 * 1024 },
}).single("file");
