//src/scripts/checkAvailabilityState.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Professional from "../models/Professional.js";
dotenv.config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const total = await Professional.countDocuments();
    const on      = await Professional.countDocuments({ isAvailableNow: true });
    const off     = await Professional.countDocuments({ isAvailableNow: false });
    const since0  = await Professional.countDocuments({ onlineSince: null });
    const sinceOn = await Professional.countDocuments({ onlineSince: { $ne: null } });

    const manualOn  = await Professional.countDocuments({ isAvailableNow: true, $or: [{ availabilityStrategy: { $exists:false } }, { availabilityStrategy: { $ne: "schedule" } }] });
    const schedOn   = await Professional.countDocuments({ isAvailableNow: true, availabilityStrategy: "schedule" });

    console.log("[CHECK] total:", total);
    console.log("[CHECK] isAvailableNow -> on:", on, " off:", off);
    console.log("[CHECK] onlineSince    -> null:", since0, " set:", sinceOn);
    console.log("[CHECK] ON by strategy -> manual-ish:", manualOn, " schedule:", schedOn);

    const sample = await Professional.find({}, { user:1, isAvailableNow:1, onlineSince:1, lastActivityAt:1, availabilityStrategy:1 })
                                     .sort({ updatedAt:-1 }).limit(5).lean();
    console.log("[SAMPLE 5]", sample);
  } catch (e) {
    console.error("check error:", e);
  } finally {
    await mongoose.disconnect();
  }
})();
