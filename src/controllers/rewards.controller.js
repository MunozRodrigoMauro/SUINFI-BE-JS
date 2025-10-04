import mongoose from "mongoose";
import { listRewards, redeemReward } from "../services/points.service.js";

export const getRewards = async (req, res) => {
  try {
    const rewards = await listRewards();
    res.json(rewards);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
};

export const redeem = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const redemption = await redeemReward({ userId: req.user.id, rewardId: req.params.id, session });
    await session.commitTransaction();
    res.status(201).json({ redemptionId: redemption._id, code: redemption.code, status: redemption.status, rewardId: redemption.rewardId });
  } catch (e) {
    await session.abortTransaction();
    res.status(400).json({ message: e.message || "Cannot redeem" });
  } finally {
    session.endSession();
  }
};
