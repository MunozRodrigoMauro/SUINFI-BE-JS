//src/scripts/backfillAvailability.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Professional from "../models/Professional.js";
dotenv.config();

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const res = await Professional.updateMany({}, { $set: { onlineSince: null } }, { timestamps: false });
  console.log("reset onlineSince ->", res.modifiedCount);
  await mongoose.disconnect();
})();
