//src/models/Report.js
import mongoose from "mongoose";


const ReportSchema = new mongoose.Schema(
{
bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
reason: {
type: String,
enum: ["fraud", "abuse", "unsafe", "no_show", "payment_issue", "other"],
required: true,
},
details: { type: String, default: "" },
attachments: [
// Optional future use if you want to allow files
{ url: String, key: String },
],
status: {
type: String,
enum: ["OPEN", "UNDER_REVIEW", "ACTION_TAKEN", "DISMISSED"],
default: "OPEN",
index: true,
},
resolutionNote: { type: String },
resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
},
{ timestamps: true }
);


// One report per (booking, reporter)
ReportSchema.index({ bookingId: 1, reporterId: 1 }, { unique: true });


export default mongoose.model("Report", ReportSchema);