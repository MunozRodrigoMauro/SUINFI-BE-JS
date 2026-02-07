// src/utils/blocks.js
import mongoose from "mongoose";
import Block from "../models/Block.js";

export async function getBlockedUserIds(me) {
  const rows = await Block.find({
    $or: [{ blocker: me }, { blocked: me }],
  })
    .select("blocker blocked")
    .lean();

  const out = new Set();
  for (const r of rows) {
    const blocker = String(r.blocker);
    const blocked = String(r.blocked);
    if (blocker === String(me)) out.add(blocked);
    else out.add(blocker);
  }
  return [...out].map((id) => new mongoose.Types.ObjectId(id));
}

export async function getBlockState(me, otherUserId) {
  const rows = await Block.find({
    $or: [
      { blocker: me, blocked: otherUserId },
      { blocker: otherUserId, blocked: me },
    ],
  })
    .select("blocker blocked")
    .lean();

  let blockedByMe = false;
  let blockedByOther = false;

  for (const r of rows) {
    const blocker = String(r.blocker);
    const blocked = String(r.blocked);
    if (blocker === String(me) && blocked === String(otherUserId)) blockedByMe = true;
    if (blocker === String(otherUserId) && blocked === String(me)) blockedByOther = true;
  }

  return { blockedByMe, blockedByOther };
}

export async function getBlockSetsForMe(me) {
  const rows = await Block.find({
    $or: [{ blocker: me }, { blocked: me }],
  })
    .select("blocker blocked")
    .lean();

  const blockedByMeSet = new Set();
  const blockedByOtherSet = new Set();

  for (const r of rows) {
    const blocker = String(r.blocker);
    const blocked = String(r.blocked);

    if (blocker === String(me)) blockedByMeSet.add(blocked);
    if (blocked === String(me)) blockedByOtherSet.add(blocker);
  }

  return { blockedByMeSet, blockedByOtherSet };
}

export async function assertNotBlocked(me, otherUserId) {
  const exists = await Block.exists({
    $or: [
      { blocker: me, blocked: otherUserId },
      { blocker: otherUserId, blocked: me },
    ],
  });
  if (exists) {
    const err = new Error("blocked");
    // @ts-ignore
    err.status = 403;
    throw err;
  }
}

/*
[CAMBIOS HECHOS AQUÍ]
- Se agregó getBlockState() y getBlockSetsForMe() para poder devolver flags a FE y evitar 403 en lecturas si querés mostrar el estado.
*/
