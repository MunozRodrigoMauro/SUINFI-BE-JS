import PaymentModel from "../models/Payment.js";
import BookingModel from "../models/Booking.js";

// POST /api/payments
export const createPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bookingId, amount, provider = "manual", details = {} } = req.body;

    if (!bookingId || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validar reserva
    const booking = await BookingModel.findOne({ _id: bookingId, user: userId });
    if (!booking) {
      return res.status(404).json({ error: "Booking not found or not authorized" });
    }

    const payment = new PaymentModel({
      booking: bookingId,
      user: userId,
      amount,
      provider,
      details,
      status: "completed" // Simulación
    });

    await payment.save();

    res.status(201).json({ message: "Payment recorded", payment });
  } catch (error) {
    console.error("❌ Error creating payment:", error);
    res.status(500).json({ error: "Server error" });
  }
};
