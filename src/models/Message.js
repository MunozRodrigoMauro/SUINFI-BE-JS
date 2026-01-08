//src/models/Message.js
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  chat: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  to:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, trim: true, required: true },
  readAt: { type: Date, default: null },
}, { timestamps: true });

messageSchema.index({ chat: 1, createdAt: 1 });

export default mongoose.model("Message", messageSchema);
