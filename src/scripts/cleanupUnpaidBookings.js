// Autocancela reservas con seña "unpaid" sin pago acreditado luego de PAYMENT_HOLD_MINUTES
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";

let running = false;

export default function startCleanupUnpaid() {
  const HOLD_MIN = Number(process.env.PAYMENT_HOLD_MINUTES || 15);
  const EVERY_MS = 60 * 1000; // corre cada 60s

  async function tick() {
    if (running) return;
    running = true;
    try {
      const cutoff = new Date(Date.now() - HOLD_MIN * 60 * 1000);

      // 🔒 Solo reservas PENDIENTES con seña realmente pendiente (unpaid).
      //    Se excluyen explícitamente las reservas "sin seña" (not_required).
      const bookings = await Booking.find({
        status: "pending",
        "deposit.status": "unpaid",
        createdAt: { $lt: cutoff },
      })
        .select("_id client professional createdAt")
        .lean();

      for (const bk of bookings) {
        // ¿Hubo algún pago acreditado?
        const paid = await Payment.exists({
          booking: bk._id,
          provider: "mercadopago",
          status: "completed",
        });

        if (paid) {
          // Si por algún motivo no se marcó deposit, no cancelamos.
          continue;
        }

        // Marcar pagos pendientes como failed
        await Payment.updateMany(
          { booking: bk._id, status: "pending" },
          { $set: { status: "failed", "details.autoCanceled": true } }
        );

        // Cancelar la reserva
        await Booking.updateOne(
          { _id: bk._id, status: "pending" },
          {
            $set: {
              status: "canceled",
              canceledAt: new Date(),
              cancelNote: "Autocancelada por falta de pago dentro del tiempo de espera",
            },
          }
        );
      }
    } catch (e) {
      console.warn("cleanupUnpaid tick error:", e?.message || e);
    } finally {
      running = false;
    }
  }

  setInterval(tick, EVERY_MS);
  // primera corrida a los 10s para no bloquear el arranque
  setTimeout(tick, 10 * 1000);
}
