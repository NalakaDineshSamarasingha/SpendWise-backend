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
  const uid = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : (mongoose.isValidObjectId(userId) ? userId : null);
  if (!uid) return null;
  const account = await Account.findOne({ $or: [{ userid: uid }, { members: uid }] }).select('_id');
  return account?._id || null;
}

// Ensure account exists for user; create default if missing
async function ensureUserAccountId(userId) {
  const uid = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : (mongoose.isValidObjectId(userId) ? userId : null);
  if (!uid) return null;
  let account = await Account.findOne({ $or: [{ userid: uid }, { members: uid }] }).select('_id');
  if (account) return account._id;
  // Create default account named 'main'
  try {
    const acc = new Account({ userid: uid, name: 'main', members: [], balance: 0 });
    await acc.save();
    return acc._id;
  } catch (e) {
    // If concurrently created, fetch again
    account = await Account.findOne({ userid: uid }).select('_id');
    return account?._id || null;
  }
}

// Create
exports.createTransaction = async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return res.status(400).json({ message: 'Authenticated user not found.' });

  // Ensure account exists (auto-create 'main' if missing)
  const accountId = await ensureUserAccountId(userId);
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
    // Update account balance: income +amount, expense -amount
    const signedAmount = type === 'income' ? amount : -amount;
    const incResult = await Account.updateOne({ _id: accountId }, { $inc: { balance: signedAmount } });
    if (!incResult.matchedCount) {
      // rollback created transaction if account update failed
      await Transaction.deleteOne({ _id: tx._id });
      return res.status(500).json({ message: 'Failed to update account balance.' });
    }
    // populate addedBy for response
    const populated = await Transaction.findById(tx._id).populate('addedBy', 'displayName email');
    const addedByName = populated.addedBy.displayName || populated.addedBy.email;
    res.status(201).json({ ...populated.toObject(), addedByName });
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

    const txs = await Transaction.find({ account: accountId })
      .sort({ date: -1 })
      .populate('addedBy', 'displayName email');
    const mapped = txs.map(t => ({
      ...t.toObject(),
      addedByName: t.addedBy?.displayName || t.addedBy?.email || null,
    }));
    res.json(mapped);
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

    const tx = await Transaction.findOne({ _id: id, account: accountId })
      .populate('addedBy', 'displayName email');
    if (!tx) return res.status(404).json({ message: 'Transaction not found.' });
    const addedByName = tx.addedBy?.displayName || tx.addedBy?.email || null;
    res.json({ ...tx.toObject(), addedByName });
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

    // Load existing transaction to compute balance delta
    const existing = await Transaction.findOne({ _id: id, account: accountId });
    if (!existing) return res.status(404).json({ message: 'Transaction not found.' });

    const allowed = ['description', 'amount', 'type', 'date', 'category'];
    const update = {};
    for (const key of allowed) {
      if (key in req.body) update[key] = req.body[key];
    }

    // Compute balance delta if amount/type changed
    const oldSigned = existing.type === 'income' ? existing.amount : -existing.amount;
    const newAmount = 'amount' in update ? update.amount : existing.amount;
    const newType = 'type' in update ? update.type : existing.type;
    const newSigned = newType === 'income' ? newAmount : -newAmount;
    const delta = newSigned - oldSigned;

    // Apply transaction update
    const updated = await Transaction.findOneAndUpdate(
      { _id: id, account: accountId },
      { $set: update },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Transaction not found after update.' });

    // If balance impacted, update account
    if (delta !== 0) {
      const incResult = await Account.updateOne({ _id: accountId }, { $inc: { balance: delta } });
      if (!incResult.matchedCount) {
        // rollback transaction update
        await Transaction.findOneAndUpdate(
          { _id: id },
          { $set: existing.toObject() }
        );
        return res.status(500).json({ message: 'Failed to update account balance.' });
      }
    }

    const populated = await Transaction.findById(updated._id).populate('addedBy', 'displayName email');
    const addedByName = populated.addedBy?.displayName || populated.addedBy?.email || null;
    res.json({ ...populated.toObject(), addedByName });
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

    // Load the transaction first to compute reverse amount
    const tx = await Transaction.findOne({ _id: id, account: accountId });
    if (!tx) return res.status(404).json({ message: 'Transaction not found.' });

    const oldSigned = tx.type === 'income' ? tx.amount : -tx.amount;
    // Delete the transaction
    const delRes = await Transaction.deleteOne({ _id: id, account: accountId });
    if (!delRes.deletedCount) return res.status(404).json({ message: 'Transaction not found.' });

    // Reverse balance effect
    const incResult = await Account.updateOne({ _id: accountId }, { $inc: { balance: -oldSigned } });
    if (!incResult.matchedCount) {
      // try to restore the transaction
      try {
        await Transaction.create({
          _id: tx._id,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          date: tx.date,
          category: tx.category,
          addedBy: tx.addedBy,
          account: tx.account,
        });
      } catch (_) {}
      return res.status(500).json({ message: 'Failed to update account balance.' });
    }

    res.json({ message: 'Transaction deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};
