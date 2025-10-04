import PointsAccount from "../models/PointsAccount.js";
import PointsTransaction, { POINT_TYPES } from "../models/PointsTransaction.js";
import Reward from "../models/Reward.js";
import Redemption, { REDEMPTION_STATUS } from "../models/Redemption.js";
import { monthKey } from "../utils/monthKey.js";
import { genVoucherCode } from "../utils/voucherCode.js";

/** Helper: asegura cuenta y retorna doc */
async function ensureAccount(userId, session) {
  let acc = await PointsAccount.findOne({ userId }).session(session);
  if (!acc) acc = await PointsAccount.create([{ userId, balance: 0 }], { session }).then(([d]) => d);
  return acc;
}

/** Crea transacción e impacta balance (con idempotencia por índices únicos) */
export async function addPoints({ userId, type, points, meta = {}, session }) {
  if (!points) return null;
  await ensureAccount(userId, session);
  const trx = await PointsTransaction.create([{ userId, type, points, meta }], { session }).then(([d]) => d);
  await PointsAccount.updateOne({ userId }, { $inc: { balance: points } }, { session });
  return trx;
}

export async function getBalance(userId) {
  const acc = await PointsAccount.findOne({ userId });
  return acc?.balance || 0;
}

export async function getHistory(userId, { limit = 50, cursor = null } = {}) {
  const q = { userId };
  if (cursor) q._id = { $lt: cursor };
  const items = await PointsTransaction.find(q).sort({ _id: -1 }).limit(limit + 1).lean();
  const nextCursor = items.length > limit ? String(items[limit - 1]?._id) : null;
  return { items: items.slice(0, limit), nextCursor };
}

/** === Reglas === */

// Booking completado
export async function onBookingCompleted({ booking, session }) {
  const clientId = booking.client;
  const proUserId = booking?.professional?.user || booking.professionalUserId; // según tu populate
  const hadDeposit = booking.depositPaid === true || booking?.deposit?.status === "paid";

  // +10 base para ambos
  await Promise.all([
    addPoints({ userId: clientId, type: POINT_TYPES.BOOKING_BASE, points: +10, meta: { bookingId: booking._id }, session }),
    addPoints({ userId: proUserId, type: POINT_TYPES.BOOKING_BASE, points: +10, meta: { bookingId: booking._id }, session }),
  ]);

  // Bonus por seña
  if (hadDeposit) {
    await Promise.all([
      addPoints({
        userId: clientId,
        type: POINT_TYPES.BOOKING_DEPOSIT_BONUS,
        points: +15,
        meta: { bookingId: booking._id },
        session,
      }),
      addPoints({
        userId: proUserId,
        type: POINT_TYPES.BOOKING_DEPOSIT_BONUS,
        points: +12,
        meta: { bookingId: booking._id },
        session,
      }),
    ]);
  }
}

// Review creada (cliente)
export async function onReviewBonus({ bookingId, userId, session }) {
  await addPoints({
    userId,
    type: POINT_TYPES.REVIEW_BONUS,
    points: +5,
    meta: { bookingId },
    session,
  });
}

// Referido: primera reserva con seña del invitado
export async function onReferralFirstDeposit({ inviterId, invitedUserId, bookingId, session, getCountOfMonth }) {
  const month = monthKey();
  const count = await getCountOfMonth?.(inviterId, month); // podés pasar una función que cuente “REFERRAL_BONUS” del mes
  if ((count || 0) >= 3) return null;
  return addPoints({
    userId: inviterId,
    type: POINT_TYPES.REFERRAL_BONUS,
    points: +5,
    meta: { bookingId, referralId: invitedUserId },
    session,
  });
}

/** === Catálogo y Canje === */
export async function listRewards() {
  return Reward.find({ active: true }).populate("partnerId", "name logoUrl").lean();
}

async function getMonthlyRedemptionsCount(rewardId, d = new Date()) {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return Redemption.countDocuments({
    rewardId,
    status: REDEMPTION_STATUS.ISSUED,
    issuedAt: { $gte: start, $lt: end },
  });
}

export async function redeemReward({ userId, rewardId, session }) {
  const [balance, reward] = await Promise.all([
    getBalance(userId),
    Reward.findById(rewardId).lean(),
  ]);
  if (!reward || !reward.active) throw new Error("Reward not available");

  const count = await getMonthlyRedemptionsCount(rewardId);
  if (count >= reward.quotaMonthly) throw new Error("Monthly quota reached");
  if (balance < reward.pointsCost) throw new Error("Insufficient points");

  // Debitar + emitir voucher
  await addPoints({
    userId,
    type: POINT_TYPES.REDEMPTION_DEBIT,
    points: -reward.pointsCost,
    meta: { note: `Redeem ${reward.title}` },
    session,
  });

  const code = genVoucherCode();
  const redemption = await Redemption.create([{ userId, rewardId, cost: reward.pointsCost, code }], { session })
    .then(([d]) => d);
  return redemption;
}
