import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending"
  },
  provider: {
    type: String,
    enum: ["mercadopago", "manual"],
    default: "manual"
  },
  details: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

const PaymentModel = mongoose.model("Payment", paymentSchema);
export default PaymentModel;
