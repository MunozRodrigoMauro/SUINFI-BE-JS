import mongoose from "mongoose";
import dotenv from "dotenv";
import Professional from "../models/Professional.js";
dotenv.config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const res = await Professional.updateMany(
      {},                               // todos
      { $set: { onlineSince: null } },  // resetea el reloj
      { timestamps: false }
    );
    console.log("reset onlineSince ->", res.modifiedCount);
  } catch (e) {
    console.error("reset error:", e);
  } finally {
    await mongoose.disconnect();
  }
})();
