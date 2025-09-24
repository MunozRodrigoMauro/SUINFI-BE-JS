import Booking from "../models/Booking.js";
import Professional from "../models/Professional.js";


/**
* Ensures the requester participated in the booking and that the booking is completed.
* Also ensures the targetUserId is the other party.
*/
export const canReport = async (req, res, next) => {
try {
const { bookingId, targetUserId } = req.body || {};
const requesterId = req.user?._id?.toString();


if (!bookingId || !targetUserId) {
return res.status(400).json({ message: "bookingId y targetUserId son obligatorios" });
}


const booking = await Booking.findById(bookingId)
.select("client professional status")
.lean();


if (!booking) return res.status(404).json({ message: "Booking no encontrado" });


// booking.client -> User
const clientUserId = booking.client?.toString();


// booking.professional -> Professional -> user
const pro = await Professional.findById(booking.professional)
.select("user")
.lean();
if (!pro) return res.status(404).json({ message: "Profesional del booking no existe" });
const proUserId = pro.user?.toString();


const involvedUserIds = [clientUserId, proUserId];


if (!involvedUserIds.includes(requesterId)) {
return res.status(403).json({ message: "No participaste de este booking" });
}
if (!involvedUserIds.includes(targetUserId)) {
return res.status(400).json({ message: "targetUserId no corresponde al booking" });
}
if (targetUserId === requesterId) {
return res.status(400).json({ message: "No podés denunciarte a vos mismo" });
}


const allowedStatuses = ["completed"]; // Ajustable según negocio
if (!allowedStatuses.includes(booking.status)) {
return res.status(400).json({ message: "Solo podés denunciar tras completar el servicio" });
}


next();
} catch (e) {
console.error("canReport error:", e);
res.status(500).json({ message: "No se pudo validar la denuncia" });
}
};