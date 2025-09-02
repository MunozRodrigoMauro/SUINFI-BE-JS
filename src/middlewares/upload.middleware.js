import multer from "multer";
import fs from "fs";
import path from "path";

const reviewsDir = path.join(process.cwd(), "uploads", "reviews");
fs.mkdirSync(reviewsDir, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, reviewsDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname) || "";
    const base = path
      .basename(file.originalname, ext)
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "")
      .slice(0, 40);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith("image/")) cb(null, true);
  else cb(new Error("Solo se permiten imágenes"), false);
};

export const uploadReviewPhotos = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB por imagen
});
