// src/controllers/mercadopago.controller.js
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import PaymentModel from "../models/Payment.js";
import Service from "../models/Service.js";
import PreBooking from "../models/PreBooking.js";
import Professional from "../models/Professional.js";
import Notification from "../models/Notification.js";
import { sendNotificationEmail } from "../services/mailer.js";
import { platformMP } from "../config/mercadopago.js";

const APP_URL = process.env.APP_PUBLIC_URL || "http://localhost:5173";
const API_URL = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const mapMpStatus = (s) => {
  const x = String(s || "").toLowerCase();
  if (x === "approved") return "completed";
  if (["rejected", "cancelled", "charged_back"].includes(x)) return "failed";
  return "pending";
};

const pick = (obj) => JSON.parse(JSON.stringify(obj || {}));
const mpErr = (e) => e?.response?.data || e?.message || e;

/* Reglas para seña personalizada */
const DEPOSIT_MIN = 2000;
const DEPOSIT_MAX = 5000;

/* ------------------------- helpers ------------------------- */
async function computeDepositAmount(bookingLike) {
  const fixed = Number(process.env.DEPOSIT_FIXED_ARS || 3000);
  const percent = Number(process.env.DEPOSIT_PERCENT || 0);

  try {
    const proId =
      bookingLike?.professionalId ||
      (typeof bookingLike?.professional === "object"
        ? bookingLike?.professional?._id
        : bookingLike?.professional);

    if (proId && mongoose.Types.ObjectId.isValid(String(proId))) {
      const pro = await Professional.findById(proId)
        .select("depositEnabled depositAmount")
        .lean();
      if (pro?.depositEnabled && Number(pro?.depositAmount) > 0) {
        // depositAmount ya validado por schema, pero lo acotamos por las dudas
        const v = Number(pro.depositAmount);
        return round2(Math.min(Math.max(v, DEPOSIT_MIN), DEPOSIT_MAX));
      }
    }
  } catch (e) {
    DBG.warn("computeDepositAmount override profesional falló:", e?.message || e);
  }

  const serviceId =
    bookingLike?.service && typeof bookingLike?.service === "object"
      ? bookingLike?.service?._id
      : bookingLike?.service;

  let price = null;
  if (serviceId) {
    try {
      const srv = await Service.findById(serviceId).lean();
      price = srv?.price ?? null;
    } catch {}
  }

  if (percent > 0 && price) {
    const pct = (Number(price) * percent) / 100;
    return round2(Math.max(pct, fixed));
  }
  return round2(fixed);
}

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  });
  const j = await r.json();
  if (!r.ok) {
    const err = new Error(j?.message || "MP error");
    err.data = j;
    throw err;
  }
  return j;
}

/** Crea Booking desde una PreBooking (idempotente) */
async function ensureBookingFromPrebooking(pre, paySet) {
  if (pre.createdBookingId) {
    const existing = await Booking.findById(pre.createdBookingId);
    if (existing) {
      DBG.ok("ensureBookingFromPrebooking: ya existía", { bookingId: existing._id.toString() });
      return existing;
    }
  }

  DBG.in("ensureBookingFromPrebooking: creando booking desde pre", {
    preId: pre._id.toString(),
    client: pre.client?.toString?.(),
    professional: pre.professional?.toString?.(),
    service: pre.service?.toString?.(),
    scheduledAt: pre.scheduledAt,
  });

  const booking = await Booking.create({
    client: pre.client,
    professional: pre.professional,
    service: pre.service,
    scheduledAt: pre.scheduledAt,
    status: "pending",
    note: pre.note || "",
    address: pre.address || "",
    depositPaid: paySet.status === "completed",
    deposit: {
      status: paySet.status === "completed" ? "paid" : "unpaid",
      amount: pre.amount || paySet.amount || 0,
      provider: "mercadopago",
      paymentId: paySet.details?.paymentId || null,
      paidAt: paySet.status === "completed" ? new Date() : null,
    },
  });

  DBG.ok("ensureBookingFromPrebooking: creado", { bookingId: booking._id.toString() });

  await PreBooking.updateOne(
    { _id: pre._id },
    { $set: { createdBookingId: booking._id, status: "approved" } }
  );

  return booking;
}

async function notifyDepositAcredited({ bookingId, paymentId, amount }) {
  try {
    if (!bookingId) return;

    const bk = await Booking.findById(bookingId)
      .populate({
        path: "professional",
        populate: { path: "user", select: "name email" },
      })
      .populate("client", "name email")
      .populate("service", "name")
      .lean();

    const proUser = bk?.professional?.user;
    if (!proUser?.email || !proUser?._id) return;

    const already = await Notification.exists({
      recipient: proUser._id,
      "metadata.paymentId": paymentId,
      type: "status",
      message: /Seña acreditada/i,
    });
    if (already) return;

    const when = new Date(bk.scheduledAt);
    const whenFmt = when.toLocaleString("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const subject = "Seña acreditada – Reserva confirmada";
    const message = `Seña acreditada para la reserva de ${bk?.client?.name || "cliente"} (${bk?.service?.name || "Servicio"} – ${whenFmt}).`;

    const deepLink = `${APP_URL}/login?redirect=${encodeURIComponent(`/bookings/${bookingId}`)}`;

    const html = `
      <div style="margin:0;padding:0;background:#f7f8fb">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fb;padding:24px 0">
          <tr><td align="center">
            <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;box-shadow:0 6px 24px rgba(16,24,40,.06);border:1px solid #e5e7eb">
              <tr><td style="padding:24px 28px 0 28px;text-align:left">
                <div style="font-weight:800;font-size:22px;letter-spacing:.5px;font-family:system-ui,-apple-system,Segoe UI,Roboto;color:#1f2a44;">CuyIT</div>
              </td></tr>
              <tr><td style="padding:16px 28px 0 28px;text-align:left">
                <p style="margin:0;color:#0f172a;font-size:16px;font-weight:700;font-family:system-ui,-apple-system,Segoe UI,Roboto">Seña acreditada</p>
                <p style="margin:4px 0 0 0;color:#475569;font-size:14px;line-height:1.6;font-family:system-ui,-apple-system,Segoe UI,Roboto">
                  ${message} Monto: <b>$${Number(amount || 0).toFixed(2)}</b>.
                </p>
              </td></tr>
              <tr><td align="center" style="padding:20px 28px 20px 28px">
                <a href="${deepLink}" style="display:inline-block;background:linear-gradient(180deg,#1f2a44,#111827);color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:800;font-size:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto;cursor:pointer">
                  Ver reserva
                </a>
              </td></tr>
            </table>
            <div style="color:#94a3b8;font-size:11px;margin-top:12px;font-family:system-ui,-apple-system,Segoe UI,Roboto">© ${new Date().getFullYear()} CuyIT</div>
          </td></tr>
        </table>
      </div>`;

    await sendNotificationEmail({
      to: proUser.email,
      subject,
      html,
      text: message,
    });

    await Notification.create({
      recipient: proUser._id,
      type: "status",
      subject,
      message,
      status: "sent",
      metadata: { bookingId: String(bookingId), paymentId: String(paymentId || ""), amount },
      sentAt: new Date(),
    });
  } catch (e) {
    console.warn("notifyDepositAcredited error:", e?.message || e);
  }
}

/* ------------------------- endpoints ------------------------- */
export const createMpDepositIntent = async (req, res) => {
  try {
    const me = req.user?.id;
    const {
      professionalId,
      serviceId,
      date,
      time,
      note = "",
      address = "",
      isImmediate = false,
    } = req.body || {};

    if (!me) return res.status(401).json({ message: "No autorizado" });
    if (!professionalId || !serviceId || !date || !time) {
      return res.status(400).json({ message: "Faltan datos de la reserva" });
    }
    if (!process.env.MP_ACCESS_TOKEN) {
      return res.status(500).json({ message: "MP no configurado (MP_ACCESS_TOKEN)" });
    }

    const pro = await Professional.findById(professionalId)
      .select("depositEnabled services")
      .lean();
    if (!pro) return res.status(404).json({ message: "Profesional no encontrado" });

    const svc = await Service.findById(serviceId).lean();
    if (!svc) return res.status(404).json({ message: "Servicio no encontrado" });

    if (!pro.depositEnabled) {
      return res
        .status(409)
        .json({ message: "Este profesional no requiere seña. Realizá la reserva directa sin pago." });
    }

    const scheduledAt = new Date(`${date}T${time}:00.000Z`);

    const busyBooking = await Booking.exists({
      professional: professionalId,
      scheduledAt,
      status: { $in: ["pending", "accepted"] },
    });
    if (busyBooking) {
      return res.status(409).json({ message: "Ese horario ya no está disponible." });
    }

    const busyPre = await PreBooking.exists({
      professional: professionalId,
      scheduledAt,
      status: "pending",
    });
    if (busyPre) {
      return res.status(409).json({ message: "Ese horario está en proceso de pago. Probá otro horario." });
    }

    const amount = await computeDepositAmount({ service: serviceId, professional: professionalId });

    const { pref } = platformMP();
    const backUrls = {
      success: `${APP_URL}/checkout/return?status=success`,
      failure: `${APP_URL}/checkout/return?status=failure`,
      pending: `${APP_URL}/checkout/return?status=pending`,
    };

    const pre = await PreBooking.create({
      client: me,
      professional: professionalId,
      service: serviceId,
      scheduledAt,
      note,
      address,
      isImmediate,
      amount,
      status: "pending",
    });

    const body = {
      items: [
        { title: `Seña de reserva – ${String(serviceId)}`, quantity: 1, unit_price: amount, currency_id: "ARS" },
      ],
      payer: { email: req.user?.email || undefined, name: req.user?.name || undefined },
      metadata: { preBookingId: String(pre._id), kind: "deposit" },
      external_reference: String(pre._id),
      back_urls: backUrls,
      notification_url: `${API_URL.replace(/\/+$/,'')}/api/payments/mp/webhook`,
      statement_descriptor: "SUINFI",
    };
    if (String(backUrls.success).startsWith("https://")) body.auto_return = "approved";

    const preference = await pref.create({ body });

    await PreBooking.updateOne({ _id: pre._id }, { $set: { mpPreferenceId: preference?.id || null } });

    return res.json({
      preBookingId: pre._id,
      preferenceId: preference?.id,
      init_point: preference?.init_point,
      sandbox_init_point: preference?.sandbox_init_point,
      amount,
    });
  } catch (e) {
    console.error("createMpDepositIntent", mpErr(e));
    return res.status(500).json({ message: "Server error" });
  }
};

export const createMpDepositPreference = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const me = req.user?.id;

    if (!bookingId) return res.status(400).json({ message: "bookingId requerido" });
    if (!mongoose.Types.ObjectId.isValid(bookingId))
      return res.status(400).json({ message: "bookingId inválido" });
    if (!process.env.MP_ACCESS_TOKEN)
      return res.status(500).json({ message: "MP no configurado (MP_ACCESS_TOKEN)" });

    const booking = await Booking.findById(bookingId)
      .populate("client", "name email")
      .populate({ path: "professional", populate: { path: "user", select: "name email" } })
      .populate("service", "name price")
      .lean();

    if (!booking) return res.status(404).json({ message: "Booking no encontrada" });
    if (String(booking.client?._id) !== String(me))
      return res.status(403).json({ message: "No autorizado" });
    if (booking.status === "canceled")
      return res.status(400).json({ message: "La reserva está cancelada" });

    const existsCompleted = await PaymentModel.findOne({
      booking: booking._id,
      provider: "mercadopago",
      status: "completed",
      "details.kind": "deposit",
    }).lean();
    if (existsCompleted) return res.status(409).json({ message: "La seña ya está pagada" });

    const amount = await computeDepositAmount({
      service: booking.service?._id || booking.service,
      professional: booking.professional?._id || booking.professional,
    });

    const { pref } = platformMP();
    const backUrls = {
      success: `${APP_URL}/checkout/return?status=success`,
      failure: `${APP_URL}/checkout/return?status=failure`,
      pending: `${APP_URL}/checkout/return?status=pending`,
    };

    const body = {
      items: [
        {
          title: `Seña de reserva – ${booking?.service?.name || "Servicio"}`,
          quantity: 1,
          unit_price: amount,
          currency_id: "ARS",
        },
      ],
      payer: { name: booking?.client?.name, email: booking?.client?.email },
      metadata: { bookingId: String(booking._id), kind: "deposit" },
      external_reference: String(booking._id),
      back_urls: backUrls,
      notification_url: `${API_URL.replace(/\/+$/,'')}/api/payments/mp/webhook`,
      statement_descriptor: "SUINFI",
    };
    if (String(backUrls.success).startsWith("https://")) body.auto_return = "approved";

    const preference = await pref.create({ body });

    await PaymentModel.create({
      booking: booking._id,
      user: booking.client._id,
      amount,
      status: "pending",
      provider: "mercadopago",
      details: {
        kind: "deposit",
        preferenceId: preference?.id || null,
        init_point: preference?.init_point || null,
        sandbox_init_point: preference?.sandbox_init_point || null,
      },
    });

    return res.json({
      preferenceId: preference?.id,
      init_point: preference?.init_point,
      sandbox_init_point: preference?.sandbox_init_point,
      amount,
    });
  } catch (e) {
    console.error("createMpDepositPreference", mpErr(e));
    return res.status(500).json({ message: "Server error" });
  }
};

export const mpWebhook = async (req, res) => {
  try {
    const q = pick(req.query);
    const b = pick(req.body);

    console.log("🔔 MP webhook");
    console.log("  query:", q);
    console.log("  body :", b);

    let type = q.type || b.type || b.topic || b.action || "";
    let paymentId = q.id || b?.data?.id || b?.id || null;

    if (String(type).includes("merchant_order")) {
      const moId =
        q.id ||
        b?.data?.id ||
        b?.id ||
        (typeof b?.resource === "string" ? b.resource.split("/").pop() : null);

      if (moId) {
        const mo = await fetchJson(`https://api.mercadopago.com/merchant_orders/${moId}`);
        paymentId = mo?.payments?.[0]?.id || null;

        if (!paymentId && mo?.external_reference) {
          const s = await fetchJson(
            `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(
              mo.external_reference
            )}&sort=date_created&criteria=desc`
          );
          paymentId = s?.results?.[0]?.id || null;
        }

        console.log("  ↳ merchant_order:", moId, "-> paymentId:", paymentId);
        type = "payment";
      }
    }

    if (type !== "payment" || !paymentId) {
      console.log("  ↳ noop (type:", type, "paymentId:", paymentId, ")");
      return res.status(200).send("ok");
    }

    const pay = await fetchJson(`https://api.mercadopago.com/v1/payments/${paymentId}`);
    console.log("  payment:", pay?.id, pay?.status, "ext_ref:", pay?.external_reference);

    const status = mapMpStatus(pay?.status);

    let preBookingId = pay?.metadata?.preBookingId || null;
    if (!preBookingId && pay?.external_reference && mongoose.Types.ObjectId.isValid(pay.external_reference)) {
      preBookingId = pay.external_reference;
    }

    const bookingId = pay?.metadata?.bookingId || pay?.external_reference || null;

    const paySet = {
      amount: Number(pay?.transaction_amount || 0),
      status,
      details: {
        kind: "deposit",
        preferenceId: pay?.metadata?.preference_id || pay?.order?.id || null,
        paymentId: pay?.id,
        raw: pay,
      },
    };

    // Flujo nuevo: PRE-BOOKING
    if (preBookingId && mongoose.Types.ObjectId.isValid(preBookingId)) {
      DBG.in("webhook PRE", { preBookingId, mpStatus: pay?.status, map: status, paymentId: pay?.id });

      const pre = await PreBooking.findById(preBookingId);
      if (!pre) {
        DBG.warn("webhook PRE: pre no encontrada", { preBookingId });
        return res.status(200).send("ok");
      }

      let bookingDoc = null;
      if (pre.createdBookingId) {
        bookingDoc = await Booking.findById(pre.createdBookingId);
        if (bookingDoc) DBG.ok("webhook PRE: booking ya existía", { bookingId: bookingDoc._id.toString() });
      }

      if (!bookingDoc && status === "completed") {
        bookingDoc = await ensureBookingFromPrebooking(pre, paySet);
      }

      if (!bookingDoc && status !== "completed") {
        DBG.warn("webhook PRE: pago no aprobado aún; guardo mpPaymentId y salgo", { paymentId: pay?.id });
        await PreBooking.updateOne({ _id: pre._id }, { $set: { mpPaymentId: pay?.id || null } });
        return res.status(200).send("ok");
      }

      let doc = await PaymentModel.findOneAndUpdate(
        { "details.paymentId": pay?.id },
        {
          $set: {
            booking: bookingDoc ? bookingDoc._id : null,
            user: pre.client,
            ...paySet,
            provider: "mercadopago",
          },
        },
        { new: true }
      );
      if (!doc) {
        doc = await PaymentModel.create({
          booking: bookingDoc ? bookingDoc._id : null,
          user: pre.client,
          ...paySet,
          provider: "mercadopago",
        });
        DBG.ok("webhook PRE: Payment creado", { paymentDbId: doc._id.toString() });
      } else {
        DBG.ok("webhook PRE: Payment actualizado", { paymentDbId: doc._id.toString() });
      }

      await PreBooking.updateOne(
        { _id: pre._id },
        { $set: { mpPaymentId: pay?.id || null, status: status === "completed" ? "approved" : pre.status } }
      );

      if (bookingDoc && status === "completed") {
        await Booking.updateOne(
          { _id: bookingDoc._id },
          {
            $set: {
              depositPaid: true,
              "deposit.status": "paid",
              "deposit.amount": paySet.amount,
              "deposit.provider": "mercadopago",
              "deposit.paymentId": pay?.id || null,
              "deposit.paidAt": new Date(),
            },
          }
        );
        DBG.ok("webhook PRE: booking marcado pagado", { bookingId: bookingDoc._id.toString() });

        await notifyDepositAcredited({ bookingId: bookingDoc._id, paymentId: pay?.id, amount: paySet.amount });
      }

      return res.status(200).send("ok");
    }

    // Flujo anterior: BOOKING ya creado
    const set = paySet;

    let doc = await PaymentModel.findOneAndUpdate(
      { "details.paymentId": pay?.id },
      { $set: set },
      { new: true }
    );

    if (!doc && bookingId) {
      doc = await PaymentModel.findOneAndUpdate(
        { booking: bookingId, provider: "mercadopago", "details.kind": "deposit" },
        { $set: set },
        { new: true }
      );
    }

    if (!doc) {
      await PaymentModel.create({
        booking: bookingId || null,
        user: null,
        amount: set.amount,
        status: set.status,
        provider: "mercadopago",
        details: set.details,
      });
    }

    if (bookingId && status === "completed") {
      try {
        await Booking.findByIdAndUpdate(
          bookingId,
          {
            $set: {
              depositPaid: true,
              "deposit.status": "paid",
              "deposit.amount": set.amount,
              "deposit.provider": "mercadopago",
              "deposit.paymentId": set.details.paymentId,
              "deposit.paidAt": new Date(),
            },
          },
          { new: true }
        );

        await notifyDepositAcredited({ bookingId, paymentId: pay?.id, amount: set.amount });
      } catch (e) {
        console.warn("booking update skipped:", e?.message || e);
      }
    }

    return res.status(200).send("ok");
  } catch (e) {
    console.error("mpWebhook", mpErr(e));
    return res.status(200).send("ok");
  }
};

export const mpReconcileByBooking = async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ message: "bookingId requerido" });

    const s = await fetchJson(
      `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(
        bookingId
      )}&sort=date_created&criteria=desc`
    );
    const pay = s?.results?.[0] || null;
    if (!pay) return res.status(404).json({ message: "No hay pagos para ese booking" });

    const status = mapMpStatus(pay?.status);
    const set = {
      amount: Number(pay?.transaction_amount || 0),
      status,
      details: {
        kind: "deposit",
        preferenceId: pay?.metadata?.preference_id || pay?.order?.id || null,
        paymentId: pay?.id,
        raw: pay,
      },
    };

    const doc = await PaymentModel.findOneAndUpdate(
      { booking: bookingId, provider: "mercadopago", "details.kind": "deposit" },
      { $set: set },
      { new: true }
    );

    if (status === "completed") {
      await Booking.findByIdAndUpdate(
        bookingId,
        {
          $set: {
            depositPaid: true,
            "deposit.status": "paid",
            "deposit.amount": set.amount,
            "deposit.provider": "mercadopago",
            "deposit.paymentId": set.details.paymentId,
            "deposit.paidAt": new Date(),
          },
        },
        { new: true }
      );

      await notifyDepositAcredited({ bookingId, paymentId: pay?.id, amount: set.amount });
    }

    return res.json({ ok: true, updated: !!doc, payment: pick(pay), db: doc });
  } catch (e) {
    console.error("mpReconcileByBooking", mpErr(e));
    return res.status(500).json({ message: "Server error" });
  }
};

export const mpReconcileByPrebooking = async (req, res) => {
  try {
    const { preBookingId } = req.body;
    DBG.in("reconcile-pre: start", { preBookingId });

    if (!preBookingId) return res.status(400).json({ message: "preBookingId requerido" });

    const s = await fetchJson(
      `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(
        preBookingId
      )}&sort=date_created&criteria=desc`
    );

    const count = Array.isArray(s?.results) ? s.results.length : 0;
    DBG.ok("reconcile-pre: search results", { count });

    const pay = s?.results?.[0] || null;
    if (!pay) {
      DBG.warn("reconcile-pre: sin pagos", { preBookingId });
      return res.status(404).json({ message: "No hay pagos para esa pre-reserva" });
    }

    const status = mapMpStatus(pay?.status);
    DBG.ok("reconcile-pre: mp status", { mp: pay?.status, map: status, paymentId: pay?.id });

    const pre = await PreBooking.findById(preBookingId);
    if (!pre) {
      DBG.warn("reconcile-pre: pre no encontrada", { preBookingId });
      return res.status(404).json({ message: "Pre-reserva no encontrada" });
    }

    const paySet = {
      amount: Number(pay?.transaction_amount || 0),
      status,
      details: {
        kind: "deposit",
        preferenceId: pay?.metadata?.preference_id || pay?.order?.id || null,
        paymentId: pay?.id,
        raw: pay,
      },
    };

    let bookingDoc = null;
    if (status === "completed") {
      bookingDoc = await ensureBookingFromPrebooking(pre, paySet);
    }

    if (!bookingDoc && status !== "completed") {
      DBG.warn("reconcile-pre: aún no aprobado, no creo Payment", { paymentId: pay?.id });
      return res.json({ ok: true, status, bookingId: null, payment: pick(pay) });
    }

    let doc = await PaymentModel.findOneAndUpdate(
      { "details.paymentId": pay?.id },
      {
        $set: {
          booking: bookingDoc ? bookingDoc._id : null,
          user: pre.client,
          ...paySet,
          provider: "mercadopago",
        },
      },
      { new: true }
    );
    if (!doc) {
      doc = await PaymentModel.create({
        booking: bookingDoc ? bookingDoc._id : null,
        user: pre.client,
        ...paySet,
        provider: "mercadopago",
      });
      DBG.ok("reconcile-pre: Payment creado", { paymentDbId: doc._id.toString() });
    } else {
      DBG.ok("reconcile-pre: Payment actualizado", { paymentDbId: doc._id.toString() });
    }

    if (bookingDoc && status === "completed") {
      await notifyDepositAcredited({ bookingId: bookingDoc._id, paymentId: pay?.id, amount: paySet.amount });
      DBG.ok("reconcile-pre: notificado profesional", { bookingId: bookingDoc._id.toString() });
    }

    return res.json({
      ok: true,
      status,
      bookingId: bookingDoc ? bookingDoc._id : null,
      payment: pick(pay),
    });
  } catch (e) {
    DBG.err("reconcile-pre error", e?.message || e);
    return res.status(500).json({ message: "Server error" });
  }
};

export const mpHealth = async (_req, res) => {
  res.json({
    ok: true,
    ts: new Date().toISOString(),
    apiPublicUrl: process.env.API_PUBLIC_URL || null,
  });
};
