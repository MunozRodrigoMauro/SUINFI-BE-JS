import PreBooking from "../models/PreBooking.js";

let runningPre = false;

export default function startCleanupUnpaidPrebookings() {
  const HOLD_MIN = Number(process.env.PREBOOK_HOLD_MINUTES || 15);
  const EVERY_MS = 60 * 1000; // corre cada 60s

  async function tick() {
    if (runningPre) return;
    runningPre = true;
    try {
      const cutoff = new Date(Date.now() - HOLD_MIN * 60 * 1000);

      const items = await PreBooking.find({
        status: "pending",
        createdAt: { $lt: cutoff },
      })
        .select("_id")
        .lean();

      if (items.length) {
        await PreBooking.updateMany(
          { _id: { $in: items.map((x) => x._id) }, status: "pending" },
          { $set: { status: "expired" } }
        );
      }
    } catch (e) {
      console.warn("cleanupUnpaidPrebookings tick error:", e?.message || e);
    } finally {
      runningPre = false;
    }
  }

  setInterval(tick, EVERY_MS);
  setTimeout(tick, 10 * 1000);
}
