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

    const {
      name,
      timeframe,
      period,
      startDate,
      endDate,
      categories,
      category,
      amount,
    } = req.body || {};

    if (!name) {
      return res.status(400).json({ message: 'name is required.' });
    }
    const sDate = startDate ? new Date(startDate) : undefined;
    const eDate = endDate ? new Date(endDate) : undefined;
    if (sDate && isNaN(sDate.getTime())) return res.status(400).json({ message: 'Invalid startDate' });
    if (eDate && isNaN(eDate.getTime())) return res.status(400).json({ message: 'Invalid endDate' });

    const normalizedPeriod = (timeframe || period || 'monthly');
    if (!['monthly', 'weekly', 'custom'].includes(normalizedPeriod)) {
      return res.status(400).json({ message: 'Invalid period/timeframe' });
    }

    let normalizedCategories = Array.isArray(categories)
      ? categories
          .map((c) => ({ category: String(c.category), limit: Number(c.limit) }))
          .filter((c) => c.category && !isNaN(c.limit) && c.limit > 0)
      : [];
    if (!normalizedCategories.length && (category || amount != null)) {
      if (amount != null && Number(amount) >= 0) {
        normalizedCategories = [{ category: category || 'General', limit: Number(amount) }];
      }
    }

    const doc = await Budget.create({
      account: accountId,
      name,
      categories: normalizedCategories,
      category: category || null,
      amount: amount != null ? Number(amount) : undefined,
      period: normalizedPeriod,
      startDate: sDate,
      endDate: eDate,
      createdBy: userId,
    });

    res.status(201).json(toDto(doc));
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
    res.json(items.map(toDto));
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
    res.json(toDto(doc));
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

    const allowed = ['name', 'category', 'amount', 'period', 'timeframe', 'startDate', 'endDate', 'categories'];
    const update = {};
    for (const key of allowed) {
      if (key in req.body) update[key] = req.body[key];
    }
    if ('timeframe' in update && !('period' in update)) {
      update.period = update.timeframe;
      delete update.timeframe;
    }
    if ('amount' in update && Number(update.amount) < 0) {
      return res.status(400).json({ message: 'amount must be non-negative.' });
    }
    if ('categories' in update) {
      const cats = Array.isArray(update.categories) ? update.categories : [];
      update.categories = cats
        .map((c) => ({ category: String(c.category), limit: Number(c.limit) }))
        .filter((c) => c.category && !isNaN(c.limit) && c.limit >= 0);
    }
    if ('startDate' in update) {
      const d = new Date(update.startDate);
      if (isNaN(d.getTime())) return res.status(400).json({ message: 'Invalid startDate' });
      update.startDate = d;
    }
    if ('endDate' in update) {
      const d = new Date(update.endDate);
      if (isNaN(d.getTime())) return res.status(400).json({ message: 'Invalid endDate' });
      update.endDate = d;
    }

    const updated = await Budget.findOneAndUpdate(
      { _id: id, account: accountId },
      { $set: update },
      { new: true }
    ).populate('createdBy', 'displayName email');

    if (!updated) return res.status(404).json({ message: 'Budget not found.' });
    res.json(toDto(updated));
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

function toDateOnlyString(d) {
  if (!d) return undefined;
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return undefined;
    const y = dt.getFullYear();
    const m = `${dt.getMonth() + 1}`.padStart(2, '0');
    const dd = `${dt.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${dd}`;
  } catch {
    return undefined;
  }
}

function toDto(doc) {
  const o = doc.toObject();
  const timeframe = o.period || 'monthly';
  const created = o.createdAt ? new Date(o.createdAt) : new Date();
  // Default dates if missing
  const fallbackStart = toDateOnlyString(getPeriodStart(created, timeframe));
  const fallbackEnd = toDateOnlyString(getPeriodEnd(created, timeframe));
  return {
    id: String(o._id),
    name: o.name,
    timeframe,
    startDate: toDateOnlyString(o.startDate) || fallbackStart,
    endDate: toDateOnlyString(o.endDate) || fallbackEnd,
    categories: Array.isArray(o.categories)
      ? o.categories.map((c) => ({ category: c.category, limit: c.limit }))
      : [],
    createdAt: o.createdAt,
  };
}

function getPeriodStart(base, tf) {
  const d = new Date(base);
  if (tf === 'weekly') {
    const day = d.getDay();
    const diff = (day + 6) % 7; // Monday start
    d.setDate(d.getDate() - diff);
  } else if (tf === 'monthly') {
    d.setDate(1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function getPeriodEnd(base, tf) {
  const d = new Date(base);
  if (tf === 'weekly') {
    const start = getPeriodStart(base, tf);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  } else if (tf === 'monthly') {
    d.setMonth(d.getMonth() + 1, 0); // last day of month
  }
  d.setHours(23, 59, 59, 999);
  return d;
}

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
