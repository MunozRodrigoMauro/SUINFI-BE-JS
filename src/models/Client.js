// src/models/Client.js
import mongoose from "mongoose";

const clientSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  phone: {
    type: String,
    trim: true,
    match: /^[0-9\s+()-]{7,20}$/,
    default: ""
  },
  address: {
    type: String,
    trim: true
  },
  preferences: {
    type: Map,
    of: String,
    default: {}
  }
}, {
  timestamps: true
});

const ClientModel = mongoose.model("Client", clientSchema);
export default ClientModel;