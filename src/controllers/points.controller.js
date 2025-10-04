import { getBalance, getHistory } from "../services/points.service.js";

export const getMyPoints = async (req, res) => {
  try {
    const balance = await getBalance(req.user.id);
    const nextCost = 200; // nivel 1
    res.json({ balance, nextReward: { cost: nextCost, missing: Math.max(0, nextCost - balance) } });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
};

export const getMyPointsHistory = async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit || "50", 10));
    const { items, nextCursor } = await getHistory(req.user.id, { limit, cursor: req.query.cursor || null });
    res.json({ items, nextCursor });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
};
