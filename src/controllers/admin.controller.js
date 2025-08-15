import AdminModel from "../models/Admin.js";

export const createAdminProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    if (role !== "admin") {
      return res.status(403).json({ message: "Only admins can create profile" });
    }

    const existing = await AdminModel.findOne({ user: userId });
    if (existing) {
      return res.status(400).json({ message: "Admin profile already exists" });
    }

    const profile = new AdminModel({
      user: userId,
      ...req.body
    });

    const saved = await profile.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("Error creating admin profile:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

export const getAdminProfile = async (req, res) => {
  try {
    const admin = await AdminModel.findOne({ user: req.user.id }).populate("user", "name email");
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    res.status(200).json(admin);
  } catch (error) {
    console.error("Error fetching admin profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};