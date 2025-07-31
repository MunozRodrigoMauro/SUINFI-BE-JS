import ChatModel from "../models/Chat.js";
import MessageModel from '../models/Message.js';

// 📌 Crear nuevo chat o reutilizar existente
export const getOrCreateChat = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recipientId } = req.body;

    if (!recipientId) return res.status(400).json({ error: "recipientId is required" });

    let chat = await ChatModel.findOne({
      participants: { $all: [userId, recipientId], $size: 2 }
    }).populate("lastMessage");

    if (!chat) {
      chat = new ChatModel({ participants: [userId, recipientId] });
      await chat.save();
    }

    res.status(200).json(chat);
  } catch (error) {
    console.error("❌ Error getting/creating chat:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// 📌 Enviar mensaje
export const sendMessage = async (req, res) => {
    try {
      const userId = req.user.id;
      const { chatId, content } = req.body;
  
      if (!chatId || !content) {
        return res.status(400).json({ error: "chatId and content are required" });
      }
  
      const message = new MessageModel({
        chat: chatId,
        sender: userId,
        content
      });
  
      await message.save();
  
      await ChatModel.findByIdAndUpdate(chatId, { lastMessage: message._id });
  
      res.status(201).json(message);
    } catch (error) {
      console.error("❌ Error sending message:", error);
      res.status(500).json({ error: "Server error" });
    }
  };
  
  // 📌 Obtener mensajes de un chat
  export const getMessages = async (req, res) => {
    try {
      const { chatId } = req.params;
  
      const messages = await MessageModel.find({ chat: chatId })
        .sort({ createdAt: 1 })
        .populate("sender", "name role");
  
      res.status(200).json(messages);
    } catch (error) {
      console.error("❌ Error getting messages:", error);
      res.status(500).json({ error: "Server error" });
    }
  };
  