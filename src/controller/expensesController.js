const Account = require('../models/Account');

// Create a new account
exports.createAccount = async (req, res) => {
  try {
    const { name, members, balance } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Account name is required.' });
    }
    const account = new Account({
      name,
      members: members || [],
      balance: balance || 0
    });
    await account.save();
    res.status(201).json({ message: 'Account created successfully.', account });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Add more expense-related functions here
