const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, default: null },
    amount: { type: Number, required: true, min: 0 },
    period: { type: String, enum: ['monthly', 'weekly', 'custom'], default: 'monthly' },
    startDate: { type: Date },
    endDate: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Budget', budgetSchema);
