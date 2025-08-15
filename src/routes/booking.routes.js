// src/routes/booking.routes.js
import express from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import {
  createBooking,
  getMyBookings,
  getBookingsForMe,
  updateBookingStatus,
} from "../controllers/booking.controller.js";

const router = express.Router();

router.post("/", verifyToken, createBooking);
router.get("/mine", verifyToken, getMyBookings);       // cliente
router.get("/for-me", verifyToken, getBookingsForMe);  // profesional
router.patch("/:id", verifyToken, updateBookingStatus);

export default router;