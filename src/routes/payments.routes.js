import express from "express";
import { verifyToken, requireAdmin } from "../middlewares/auth.middleware.js";
import { createPayment as createPaymentManual } from "../controllers/payment.controller.js";
import {
  createMpDepositPreference,
  createMpDepositIntent,
  mpWebhook,
  mpReconcileByBooking,
  mpReconcileByPrebooking,
  mpHealth,
} from "../controllers/mercadopago.controller.js";
import {
  listDepositPayments,
  refundManual,
  createPayout,
  listPayouts,
} from "../controllers/payment.admin.controller.js";

const router = express.Router();

// Pago manual (si lo usás)
router.post("/", verifyToken, createPaymentManual);

// MP (nuevo y anterior)
router.post("/mp/intent", verifyToken, createMpDepositIntent);
router.post("/mp/deposit", verifyToken, createMpDepositPreference);

// Webhook MP
router.post(
  "/mp/webhook",
  express.urlencoded({ extended: true }),
  express.json({ type: "*/*" }),
  mpWebhook
);

// Reconciliaciones
router.post("/mp/reconcile", verifyToken, mpReconcileByBooking);
router.post("/mp/reconcile-pre", verifyToken, mpReconcileByPrebooking);

// Health
router.get("/mp/health", mpHealth);

// ===== ADMIN: liquidaciones & refunds =====
router.get("/admin/deposits", verifyToken, requireAdmin, listDepositPayments);
router.post("/admin/refund", verifyToken, requireAdmin, refundManual);
router.post("/admin/payouts", verifyToken, requireAdmin, createPayout);
router.get("/admin/payouts", verifyToken, requireAdmin, listPayouts);

export default router;
