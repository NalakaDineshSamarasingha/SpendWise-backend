const Account = require('../models/Account');

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
      userid: user._id,
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
    const account = await Account.findOne({ $or: [ { userid: userId }, { members: userId } ] }).populate('members');
    if (!account) {
      return res.status(404).json({ hasAccount: false });
    }
    // Optionally, format user data for response
    return res.json({ hasAccount: true, data: account });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};
