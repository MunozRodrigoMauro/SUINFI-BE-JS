//src/routes/report.routes.js
import { Router } from "express";
import { verifyToken, requireAdmin } from "../middlewares/auth.middleware.js";
import { canReport } from "../middlewares/canReport.middleware.js";
import {
createReport,
getMyReports,
listReports,
updateReportStatus,
} from "../controllers/report.controller.js";


const router = Router();


// Crear denuncia (solo usuarios logueados que participaron del booking y tras completarlo)
router.post("/", verifyToken, canReport, createReport);


// Mis denuncias
router.get("/mine", verifyToken, getMyReports);


// Admin
router.get("/", verifyToken, requireAdmin, listReports);
router.patch("/:id", verifyToken, requireAdmin, updateReportStatus);


export default router;