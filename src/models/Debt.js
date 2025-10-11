const mongoose = require("mongoose");

const debtSchema = new mongoose.Schema({
  userid: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  type: { type: String, enum: ["owe", "receive"], required: true },
  person: { type: mongoose.Schema.Types.ObjectId, ref: "User",required:false }, 
  personName: { type: String},
  amount:{type:Number},
  reason:{type:String},
  status:{type:String,enum:["pending","partial","settled"]},
  paidAmount:{type:Number},
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Debt", debtSchema);
