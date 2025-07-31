// src/controllers/notification.controller.js
import NotificationModel from "../models/Notification.js";

export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await NotificationModel.find({ recipient: userId })
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error("❌ Error fetching notifications:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await NotificationModel.findByIdAndUpdate(id, { read: true });
    res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("❌ Error marking notification:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// 📌 Crea una nueva notificación
export const createNotification = async (req, res) => {
    try {
      const { recipient, message, type, metadata } = req.body;
  
      if (!recipient || !message || !type) {
        return res.status(400).json({ error: "Missing required fields" });
      }
  
      const notification = new NotificationModel({
        recipient,
        message,
        type,
        metadata: metadata || {}
      });
  
      await notification.save();
  
      res.status(201).json({ message: "Notification created", notification });
    } catch (error) {
      console.error("❌ Error creating notification:", error);
      res.status(500).json({ error: "Server error" });
    }
  };
