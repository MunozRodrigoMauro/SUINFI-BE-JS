//src/controllers/report.controller.js
import Report from "../models/Report.js";


export const createReport = async (req, res) => {
try {
const { bookingId, targetUserId, reason, details } = req.body || {};
const reporterId = req.user._id;


if (!reason) return res.status(400).json({ message: "Falta reason" });


const report = await Report.create({
bookingId,
reporterId,
targetUserId,
reason,
details: (details || "").trim(),
});
res.status(201).json(report);
} catch (e) {
if (e?.code === 11000) {
return res.status(409).json({ message: "Ya denunciaste este booking" });
}
console.error("createReport error:", e);
res.status(500).json({ message: "No se pudo crear la denuncia" });
}
};


export const getMyReports = async (req, res) => {
const list = await Report.find({ reporterId: req.user._id })
.sort({ createdAt: -1 })
.lean();
res.json(list);
};


// Admin endpoints
export const listReports = async (_req, res) => {
const list = await Report.find().sort({ createdAt: -1 }).lean();
res.json(list);
};


export const updateReportStatus = async (req, res) => {
const { id } = req.params;
const { status, resolutionNote } = req.body || {};
if (!status) return res.status(400).json({ message: "Falta status" });


const report = await Report.findByIdAndUpdate(
id,
{ $set: { status, resolutionNote } },
{ new: true }
);
if (!report) return res.status(404).json({ message: "Report no encontrado" });
res.json(report);
};