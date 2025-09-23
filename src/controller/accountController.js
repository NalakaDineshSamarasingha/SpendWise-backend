const User = require('../models/User');
const Account = require('../models/Account');
const mongoose = require('mongoose');

// Escape regex special chars in user input
function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /account/users/suggest?q=par
// Returns up to 10 users whose email contains the partial (case-insensitive)
// Response: { users: [{ id, email, displayName, picture }] }
exports.suggestUsersByEmail = async (req, res) => {
	try {
		const q = (req.query.q || '').trim();
		if (q.length < 3) {
			return res.status(400).json({ message: 'Query parameter q must be at least 3 characters.' });
		}
		const safe = escapeRegex(q);
		const regex = new RegExp(safe, 'i');
		const users = await User.find({ email: { $regex: regex } })
			.select('_id email displayName picture')
			.limit(10)
			.lean();
		res.json({ users: users.map(u => ({
			id: u._id,
			email: u.email,
			displayName: u.displayName || null,
			picture: u.picture || null,
		})) });
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

// POST /account/members  { email: "someone@example.com" }
// Adds the user with provided email as a member of the authenticated user's account
exports.addMemberToAccount = async (req, res) => {
	try {
		const { email } = req.body;
		if (!email) return res.status(400).json({ message: 'Email is required.' });

		// Find target user
		const targetUser = await User.findOne({ email }).select('_id email displayName');
		if (!targetUser) return res.status(404).json({ message: 'User with that email not found.' });

		// Resolve authenticated user id
		const authUserId = (req.user && (req.user._id || req.user.id)) ? req.user._id || req.user.id : null;
		if (!authUserId || !mongoose.Types.ObjectId.isValid(authUserId)) {
			return res.status(400).json({ message: 'Authenticated user id not found or invalid.' });
		}
		const ownerId = new mongoose.Types.ObjectId(authUserId);

		// Find owner's account (account _id == ownerId)
		let account = await Account.findOne({ userid: ownerId });
		if (!account) {
			return res.status(404).json({ message: 'Owner account not found. Create an account first.' });
		}

		// Prevent adding self
		if (targetUser._id.equals(ownerId)) {
			return res.status(400).json({ message: 'Cannot add yourself as a member.' });
		}

		// Add member if not already present
		if (account.members.some(m => m.equals(targetUser._id))) {
			return res.status(200).json({ message: 'User already a member.', accountId: account._id });
		}

		account.members.push(targetUser._id);
		await account.save();

		res.status(201).json({
			message: 'Member added successfully.',
			member: { id: targetUser._id, email: targetUser.email, displayName: targetUser.displayName || null },
			accountId: account._id,
			members: account.members,
		});
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

// GET /account/collaborators  -> returns members (users) of the authenticated user's account
exports.getAccountCollaborators = async (req, res) => {
	try {
		const authUserId = (req.user && (req.user._id || req.user.id)) ? req.user._id || req.user.id : null;
		if (!authUserId || !mongoose.Types.ObjectId.isValid(authUserId)) {
			return res.status(400).json({ message: 'Authenticated user id not found or invalid.' });
		}
		const ownerId = new mongoose.Types.ObjectId(authUserId);

		// Find account where user is owner (account._id == ownerId) OR member
		const account = await Account.findOne({ $or: [ { userid: ownerId }, { members: ownerId } ] })
			.populate('members', '_id email displayName picture createdAt');
		if (!account) {
			return res.status(404).json({ message: 'Account not found for user.' });
		}

		// Build users list: owner + members (avoid duplicate if owner also in members)
		const ownerUser = await User.findById(account._id).select('_id email displayName picture createdAt');
		const memberMap = new Map();
		if (ownerUser) {
			memberMap.set(ownerUser._id.toString(), {
				id: ownerUser._id,
				email: ownerUser.email,
				displayName: ownerUser.displayName || null,
				picture: ownerUser.picture || null,
				role: 'owner',
				createdAt: ownerUser.createdAt,
			});
		}
		for (const m of account.members || []) {
			memberMap.set(m._id.toString(), {
				id: m._id,
				email: m.email,
				displayName: m.displayName || null,
				picture: m.picture || null,
				role: memberMap.has(m._id.toString()) ? memberMap.get(m._id.toString()).role : 'member',
				createdAt: m.createdAt,
			});
		}

		const users = Array.from(memberMap.values());
		res.json({ users, count: users.length, accountId: account._id });
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};