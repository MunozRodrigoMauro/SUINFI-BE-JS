//src/scripts/fixStrategyForEmptySchedule.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Professional from "../models/Professional.js";
dotenv.config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const pros = await Professional.find(
      { availabilityStrategy: "schedule" },
      { _id:1, user:1, availabilitySchedule:1 }
    ).lean();

    let modified = 0;
    for (const p of pros) {
      const raw = p.availabilitySchedule && typeof p.availabilitySchedule === "object"
        ? (p.availabilitySchedule instanceof Map ? Object.fromEntries(p.availabilitySchedule) : p.availabilitySchedule)
        : {};
      const hasAny = Object.values(raw).some(v => v && v.from && v.to);
      if (!hasAny) {
        await Professional.updateOne({ _id: p._id }, { $set: { availabilityStrategy: "manual" } }, { timestamps:false });
        modified++;
        console.log("[FIX empty schedule] user=%s -> manual", String(p.user));
      }
    }
    console.log("fix empty schedules ->", modified);
  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
})();
