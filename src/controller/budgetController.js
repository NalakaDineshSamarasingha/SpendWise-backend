const mongoose = require('mongoose');
const Budget = require('../models/Budget');
const Account = require('../models/Account');
const User = require('../models/User');

// Helpers (aligned with transactionController)
async function getAuthenticatedUserId(req) {
  if (req.user?._id && mongoose.Types.ObjectId.isValid(req.user._id)) return req.user._id;
  if (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) return req.user.id;
  if (req.user?.email) {
    const user = await User.findOne({ email: req.user.email }).select('_id');
    return user?._id;
  }
  return null;
}

async function getUserAccountId(userId) {
  if (!userId) return null;
  const uid = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : (mongoose.isValidObjectId(userId) ? userId : null);
  if (!uid) return null;
  const account = await Account.findOne({ $or: [{ userid: uid }, { members: uid }] }).select('_id');
  return account?._id || null;
}

async function ensureUserAccountId(userId) {
  const uid = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : (mongoose.isValidObjectId(userId) ? userId : null);
  if (!uid) return null;
  let account = await Account.findOne({ $or: [{ userid: uid }, { members: uid }] }).select('_id');
  if (account) return account._id;
  try {
    const acc = new Account({ userid: uid, name: 'main', members: [], balance: 0 });
    await acc.save();
    return acc._id;
  } catch (e) {
    account = await Account.findOne({ userid: uid }).select('_id');
    return account?._id || null;
  }
}

// Create Budget
exports.createBudget = async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return res.status(400).json({ message: 'Authenticated user not found.' });

    const accountId = await ensureUserAccountId(userId);
    if (!accountId) return res.status(404).json({ message: 'Account not found for user.' });

    const { name, category, amount, period, startDate, endDate } = req.body;
    if (!name || amount == null) {
      return res.status(400).json({ message: 'name and amount are required.' });
    }
    if (amount < 0) {
      return res.status(400).json({ message: 'amount must be non-negative.' });
    }

    const budget = await Budget.create({
      account: accountId,
      name,
      category: category || null,
      amount,
      period: period || 'monthly',
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      createdBy: userId,
    });

    res.status(201).json(budget);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Read all Budgets for user's account
exports.getBudgets = async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return res.status(400).json({ message: 'Authenticated user not found.' });
    const accountId = await getUserAccountId(userId);
    if (!accountId) return res.status(404).json({ message: 'Account not found for user.' });

    const items = await Budget.find({ account: accountId })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'displayName email');
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Read one Budget by id (must belong to same account)
exports.getBudgetById = async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const accountId = await getUserAccountId(userId);
    if (!accountId) return res.status(404).json({ message: 'Account not found for user.' });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid budget id.' });

    const doc = await Budget.findOne({ _id: id, account: accountId })
      .populate('createdBy', 'displayName email');
    if (!doc) return res.status(404).json({ message: 'Budget not found.' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Update Budget (only allow certain fields)
exports.updateBudget = async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const accountId = await getUserAccountId(userId);
    if (!accountId) return res.status(404).json({ message: 'Account not found for user.' });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid budget id.' });

    const allowed = ['name', 'category', 'amount', 'period', 'startDate', 'endDate'];
    const update = {};
    for (const key of allowed) {
      if (key in req.body) update[key] = req.body[key];
    }
    if ('amount' in update && update.amount < 0) {
      return res.status(400).json({ message: 'amount must be non-negative.' });
    }

    const updated = await Budget.findOneAndUpdate(
      { _id: id, account: accountId },
      { $set: update },
      { new: true }
    ).populate('createdBy', 'displayName email');

    if (!updated) return res.status(404).json({ message: 'Budget not found.' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Delete Budget
exports.deleteBudget = async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const accountId = await getUserAccountId(userId);
    if (!accountId) return res.status(404).json({ message: 'Account not found for user.' });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid budget id.' });

    const del = await Budget.deleteOne({ _id: id, account: accountId });
    if (!del.deletedCount) return res.status(404).json({ message: 'Budget not found.' });
    res.json({ message: 'Budget deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};
