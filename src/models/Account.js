const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema({
  userid: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name: { type: String, required: true }, 
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], 
  balance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Account", accountSchema);
