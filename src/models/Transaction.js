const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ["expense", "income"], required: true },
  date: { type: Date, default: Date.now },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
  category: { type: String },
});

module.exports = mongoose.model("Transaction", transactionSchema);
