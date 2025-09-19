import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Booking from "../models/Booking.js";
import Professional from "../models/Professional.js";
import Payout from "../models/Payout.js";
import { sendNotificationEmail } from "../services/mailer.js";

/**
 * GET /api/payments/admin/deposits
 * Lista pagos de seña aprobados (para refund o liquidación)
 */
export const listDepositPayments = async (_req, res) => {
  try {
    const items = await Payment.find({
      provider: "mercadopago",
      status: "completed",
      "details.kind": "deposit",
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "booking",
        populate: [
          { path: "client", select: "name email" },
          { path: "professional", populate: { path: "user", select: "name email" } },
          { path: "service", select: "name" },
        ],
      })
      .lean();

    // adjuntar si ya tuvo payout y snapshot de payout del pro
    const out = await Promise.all(
      items.map(async (p) => {
        const payout = await Payout.findOne({ payment: p._id }).lean();
        const proId = p?.booking?.professional?._id;
        const pro = proId ? await Professional.findById(proId).select("payout").lean() : null;
        return {
          ...p,
          hasPayout: !!payout,
          payoutInfo: pro?.payout || {},
        };
      })
    );

    res.json(out);
  } catch (e) {
    console.error("listDepositPayments error", e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/payments/admin/refund
 * body: { paymentId, amount, reason }
 * Marca reembolso manual y actualiza booking.deposit.status='refunded'
 */
export const refundManual = async (req, res) => {
  try {
    const { paymentId, amount, reason = "" } = req.body;
    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({ message: "paymentId inválido" });
    }
    const pay = await Payment.findById(paymentId);
    if (!pay) return res.status(404).json({ message: "Payment no encontrado" });
    if (pay.status !== "completed") {
      return res.status(400).json({ message: "Solo se puede reembolsar pagos completados" });
    }
    const amt = Number(amount || pay.amount);
    if (!Number.isFinite(amt) || amt <= 0 || amt > pay.amount) {
      return res.status(400).json({ message: "amount inválido" });
    }

    pay.refund = {
      status: "refunded",
      amount: amt,
      reason,
      provider: "manual",
      externalId: "",
      processedBy: req.user?._id || null,
      processedAt: new Date(),
    };
    await pay.save();

    if (pay.booking) {
      await Booking.updateOne(
        { _id: pay.booking },
        {
          $set: {
            depositPaid: false,
            "deposit.status": "refunded",
            "deposit.refundedAt": new Date(),
          },
        }
      );
    }

    // notificación por email simple (si tenemos datos)
    try {
      const bk = await Booking.findById(pay.booking)
        .populate("client", "name email")
        .populate("service", "name")
        .lean();

      if (bk?.client?.email) {
        await sendNotificationEmail({
          to: bk.client.email,
          subject: "Reembolso de seña",
          text: `Tu seña para "${bk?.service?.name || "servicio"}" fue reembolsada por $${amt.toFixed(2)}.`,
          html: `<p>Tu seña para <b>${bk?.service?.name || "servicio"}</b> fue reembolsada por <b>$${amt.toFixed(
            2
          )}</b>.</p>`,
        });
      }
    } catch (e) {
      console.warn("refund email warn:", e?.message || e);
    }

    res.json({ ok: true, payment: pay });
  } catch (e) {
    console.error("refundManual error", e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/payments/admin/payouts
 * body: { paymentId, amount, notes }
 * Registra una liquidación al profesional (manual)
 */
export const createPayout = async (req, res) => {
  try {
    const { paymentId, amount, notes = "" } = req.body;
    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({ message: "paymentId inválido" });
    }
    const pay = await Payment.findById(paymentId).populate({
      path: "booking",
      populate: { path: "professional" },
    });
    if (!pay) return res.status(404).json({ message: "Payment no encontrado" });
    if (pay.status !== "completed") {
      return res.status(400).json({ message: "El pago no está aprobado" });
    }
    const amt = Number(amount || pay.amount);
    if (!Number.isFinite(amt) || amt <= 0 || amt > pay.amount) {
      return res.status(400).json({ message: "amount inválido" });
    }
    const pro = await Professional.findById(pay.booking.professional).select("payout");
    if (!pro) return res.status(404).json({ message: "Professional no encontrado" });

    const already = await Payout.findOne({ payment: pay._id });
    if (already) return res.status(409).json({ message: "Ya existe una liquidación para este pago" });

    const snapshot = {
      holderName: pro.payout?.holderName || "",
      docType: pro.payout?.docType || "",
      docNumber: pro.payout?.docNumber || "",
      bankName: pro.payout?.bankName || "",
      cbu: pro.payout?.cbu || "",
      alias: pro.payout?.alias || "",
    };

    const doc = await Payout.create({
      payment: pay._id,
      booking: pay.booking._id,
      professional: pay.booking.professional._id || pay.booking.professional,
      amount: amt,
      status: "paid",
      method: "bank",
      snapshot,
      notes,
      processedBy: req.user?._id || null,
      processedAt: new Date(),
    });

    res.status(201).json({ ok: true, payout: doc });
  } catch (e) {
    console.error("createPayout error", e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/payments/admin/payouts
 */
export const listPayouts = async (_req, res) => {
  try {
    const items = await Payout.find()
      .sort({ createdAt: -1 })
      .populate({
        path: "booking",
        populate: [
          { path: "service", select: "name" },
          { path: "professional", populate: { path: "user", select: "name email" } },
        ],
      })
      .populate("payment")
      .lean();
    res.json(items);
  } catch (e) {
    console.error("listPayouts error", e);
    res.status(500).json({ message: "Server error" });
  }
};
