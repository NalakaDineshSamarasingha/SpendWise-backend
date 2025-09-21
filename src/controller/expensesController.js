const mongoose = require('mongoose');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

// Create a new account
exports.createAccount = async (req, res) => {
  try {
    const { name, balance } = req.body;
    // Validate account name
    if (!name) {
      return res.status(400).json({ message: 'Account name is required.' });
    }
    // Get user id from email
    const email = req.user && req.user.email;
    if (!email) {
      return res.status(400).json({ message: 'Authenticated user email not found.' });
    }
    const User = require('../models/User');
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found for provided email.' });
    }
    // Create account with user._id as _id
    const account = new Account({
      _id: user._id,
      name,
      members: [],
      balance: balance || 0
    });
    await account.save();
    res.status(201).json({ message: 'Account created successfully.', account });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};


// Check if a user has an account
exports.checkUserAccount = async (req, res) => {
  try {
    const userId = req.params.userId;
    // Cast to ObjectId for reliable matching
    const uid = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : null;
    // Find account where _id equals userId or members contains userId
    const account = uid
      ? await Account.findOne({ $or: [ { userid: uid }, { members: uid } ] }).populate('members')
      : null;
    if (!account) {
      return res.status(404).json({ hasAccount: false });
    }
    // Fetch transactions for this account with addedBy populated
    const txDocs = await Transaction.find({ account: account._id })
      .sort({ date: -1 })
      .populate('addedBy', 'displayName email');
    const transactions = txDocs.map(t => {
      const obj = t.toObject();
      obj.addedByName = t.addedBy?.displayName || t.addedBy?.email || null;
      return obj;
    });
    // Compute totals
    const totals = transactions.reduce((acc, t) => {
      if (t.type === 'income') acc.income += t.amount;
      else if (t.type === 'expense') acc.expenses += t.amount;
      return acc;
    }, { income: 0, expenses: 0 });

    const payload = {
      accountBalance: account.balance,
      income: totals.income,
      expenses: totals.expenses,
      transactions,
    };
    return res.json({ hasAccount: true, data: payload });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};
