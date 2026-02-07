// src/controllers/block.controller.js
import mongoose from "mongoose";
import Block from "../models/Block.js";

const isValidId = (v) => mongoose.Types.ObjectId.isValid(String(v));

function getMeId(req) {
  const v = req?.user?.id || req?.user?._id || "";
  return String(v || "");
}

export const blockUser = async (req, res) => {
  try {
    const me = getMeId(req);
    if (!me) return res.status(401).json({ message: "No autorizado" });

    const otherUserId = String(req.params?.otherUserId || "");
    if (!isValidId(otherUserId)) return res.status(400).json({ message: "otherUserId inválido" });
    if (String(otherUserId) === String(me)) {
      return res.status(400).json({ message: "No podés bloquearte a vos mismo" });
    }

    const result = await Block.updateOne(
      { blocker: me, blocked: otherUserId },
      { $setOnInsert: { blocker: me, blocked: otherUserId } },
      { upsert: true }
    );

    const created = Boolean(result?.upsertedCount);
    return res.status(created ? 201 : 200).json({ ok: true, created });
  } catch (e) {
    // duplicate key (ya existía)
    if (e && typeof e === "object" && e.code === 11000) {
      return res.status(200).json({ ok: true, created: false });
    }
    return res.status(500).json({ message: "Server error" });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const me = getMeId(req);
    if (!me) return res.status(401).json({ message: "No autorizado" });

    const otherUserId = String(req.params?.otherUserId || "");
    if (!isValidId(otherUserId)) return res.status(400).json({ message: "otherUserId inválido" });

    await Block.deleteOne({ blocker: me, blocked: otherUserId });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
};

export const getBlockState = async (req, res) => {
  try {
    const me = getMeId(req);
    if (!me) return res.status(401).json({ message: "No autorizado" });

    const otherUserId = String(req.params?.otherUserId || "");
    if (!isValidId(otherUserId)) return res.status(400).json({ message: "otherUserId inválido" });

    const [byMe, byOther] = await Promise.all([
      Block.exists({ blocker: me, blocked: otherUserId }),
      Block.exists({ blocker: otherUserId, blocked: me }),
    ]);

    const blockedByMe = Boolean(byMe);
    const blockedByOther = Boolean(byOther);

    return res.json({
      blockedByMe,
      blockedByOther,
      blocked: blockedByMe || blockedByOther,
    });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
};

/*
[CAMBIOS HECHOS AQUÍ]
- Se implementó POST/DELETE de blocks para que Mobile deje de recibir 404.
- Se agregó endpoint opcional de estado para que el FE pueda leer blockedByMe/blockedByOther si lo necesita.
*/
