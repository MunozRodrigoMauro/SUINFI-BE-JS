//src/utils/notifications-cron.js
import cron from "node-cron";
import Notification from "../models/Notification.js";
import { dispatchEmailForNotification } from "../services/notification.service.js";

export function registerNotificationsCron() {
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    try {
      const due = await Notification.find({
        status: "pending",
        channel: "email",
        notBefore: { $lte: now },
      })
        .sort({ notBefore: 1 })
        .limit(50)
        .lean();

      if (due.length) {
        console.log(`📬 notifications-cron → procesando ${due.length} pendiente(s)...`);
      }

      for (const n of due) {
        await dispatchEmailForNotification(n);
      }
    } catch (e) {
      console.error("notifications-cron error:", e?.message || e);
    }
  });

  console.log("⏱️ Notifications cron registrado (cada 1').");
}
