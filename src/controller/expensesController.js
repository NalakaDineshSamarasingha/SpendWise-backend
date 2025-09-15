const Account = require('../models/Account');

// Create a new account
exports.createAccount = async (req, res) => {
  try {
    const { name, balance } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Account name is required.' });
    }
    // Set _id to the authenticated user's id, members to empty
    const account = new Account({
      _id: req.user._id,
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
    // Find account where _id or members contains userId
    const account = await Account.findOne({ $or: [ { _id: userId }, { members: userId } ] }).populate('members');
    if (!account) {
      return res.status(404).json({ hasAccount: false });
    }
    // Optionally, format user data for response
    return res.json({ hasAccount: true, data: account });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};
