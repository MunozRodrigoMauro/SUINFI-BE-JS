import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }], // 2 por ahora
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  lastMessageText: { type: String, default: "" },
}, { timestamps: true });

conversationSchema.index({ participants: 1 });

export default mongoose.model("Conversation", conversationSchema);
