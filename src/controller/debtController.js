const Debt = require('../models/Debt');
const User = require('../models/User');
const Account = require('../models/Account');

async function getAuthenticatedUserId(req) {
  if (req.user?._id && mongoose.Types.ObjectId.isValid(req.user._id)) return req.user._id;
  if (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) return req.user.id;
  if (req.user?.email) {
    const user = await User.findOne({ email: req.user.email }).select('_id');
    return user?._id;
  }
  return null;
}

exports.createNewDebt = async (req,res) =>{
    try {
      const userId = await getAuthenticatedUserId(req);
      if (!userId) return res.status(400).json({ message: 'Authenticated user not found.' });
    
      const accountId = await ensureUserAccountId(userId);
      if (!accountId) return res.status(404).json({ message: 'Account not found for user.' });
    
        const { type, person, amount,personName, reason } = req.body;
        if (!type || amount == null || !personName) {
          return res.status(400).json({ message: 'Type, amount, and personName are required.' });
        }
    
        const debt = new Debt({
          userId,
          type,
          person: person || null,
          amount,
          reason,
          paidAmount: 0,
          status:"pending",
          personName:personName
        });
    
        await debt.save();

        res.status(201).json({message:"Debt added"});
      } catch (error) {
        res.status(500).json({ message: 'Server error.', error: error.message });
      }
}

exports.getAllDebt = async (req,res) => {
  try {
      const userId = await getAuthenticatedUserId(req);
      if (!userId) return res.status(400).json({ message: 'Authenticated user not found.' });
      const debt = await Debt.find({ $or: [ { userid: userId }, { person: userId } ] })
        .sort({ date: -1 })
        .distinct('_id')
      const mapped = debt.map(d => ({
        ...d.toObject()
      }));
      res.json(mapped);
    } catch (error) {
      res.status(500).json({ message: 'Server error.', error: error.message });
    }
}