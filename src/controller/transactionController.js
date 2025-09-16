const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const User = require('../models/User');

// Helper to get authenticated user's ObjectId
async function getAuthenticatedUserId(req) {
  if (req.user?._id && mongoose.Types.ObjectId.isValid(req.user._id)) return req.user._id;
  if (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) return req.user.id;
  if (req.user?.email) {
    const user = await User.findOne({ email: req.user.email }).select('_id');
    return user?._id;
  }
  return null;
}

// Helper to find the account associated with the authenticated user
async function getUserAccountId(userId) {
  if (!userId) return null;
  const account = await Account.findOne({ $or: [{ _id: userId }, { members: userId }] }).select('_id');
  return account?._id || null;
}

// Create
exports.createTransaction = async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return res.status(400).json({ message: 'Authenticated user not found.' });

    const accountId = await getUserAccountId(userId);
    if (!accountId) return res.status(404).json({ message: 'Account not found for user.' });

    const { description, amount, type, date, category } = req.body;
    if (!description || amount == null || !type) {
      return res.status(400).json({ message: 'description, amount, and type are required.' });
    }

    const tx = new Transaction({
      description,
      amount,
      type,
      date: date || Date.now(),
      category: category || undefined,
      addedBy: userId,
      account: accountId,
    });

    await tx.save();
    res.status(201).json(tx);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Read all for current user's account
exports.getTransactions = async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return res.status(400).json({ message: 'Authenticated user not found.' });

    const accountId = await getUserAccountId(userId);
    if (!accountId) return res.status(404).json({ message: 'Account not found for user.' });

    const txs = await Transaction.find({ account: accountId }).sort({ date: -1 });
    res.json(txs);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Read one by id (must belong to same account)
exports.getTransactionById = async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const accountId = await getUserAccountId(userId);
    if (!accountId) return res.status(404).json({ message: 'Account not found for user.' });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid transaction id.' });

    const tx = await Transaction.findOne({ _id: id, account: accountId });
    if (!tx) return res.status(404).json({ message: 'Transaction not found.' });

    res.json(tx);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Update (only allow specific fields)
exports.updateTransaction = async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const accountId = await getUserAccountId(userId);
    if (!accountId) return res.status(404).json({ message: 'Account not found for user.' });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid transaction id.' });

    const allowed = ['description', 'amount', 'type', 'date', 'category'];
    const update = {};
    for (const key of allowed) {
      if (key in req.body) update[key] = req.body[key];
    }
    // Never allow changing account or addedBy via API
    const tx = await Transaction.findOneAndUpdate(
      { _id: id, account: accountId },
      { $set: update },
      { new: true }
    );

    if (!tx) return res.status(404).json({ message: 'Transaction not found.' });

    res.json(tx);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Delete
exports.deleteTransaction = async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const accountId = await getUserAccountId(userId);
    if (!accountId) return res.status(404).json({ message: 'Account not found for user.' });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid transaction id.' });

    const result = await Transaction.findOneAndDelete({ _id: id, account: accountId });
    if (!result) return res.status(404).json({ message: 'Transaction not found.' });

    res.json({ message: 'Transaction deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};
