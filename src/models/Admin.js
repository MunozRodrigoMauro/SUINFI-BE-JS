import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  permissions: [
    {
      type: String,
      enum: ["manage_users", "manage_services", "view_reports", "manage_payments"]
    }
  ],
  lastLogin: {
    type: Date
  },
  activityLogs: [
    {
      type: String
    }
  ]
}, {
  timestamps: true
});

const AdminModel = mongoose.model("Admin", adminSchema);
export default AdminModel;