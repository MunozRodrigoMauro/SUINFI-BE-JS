import ClientModel from "../models/Client.js";

export const createClientProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    if (role !== "client") {
      return res.status(403).json({ message: "Only clients can create profile" });
    }

    const existing = await ClientModel.findOne({ user: userId });
    if (existing) {
      return res.status(400).json({ message: "Client profile already exists" });
    }

    const profile = new ClientModel({
      user: userId,
      ...req.body
    });

    const saved = await profile.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("Error creating client profile:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

export const getClientProfile = async (req, res) => {
  try {
    const client = await ClientModel.findOne({ user: req.user.id }).populate("user", "name email");
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.status(200).json(client);
  } catch (error) {
    console.error("Error fetching client profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};
