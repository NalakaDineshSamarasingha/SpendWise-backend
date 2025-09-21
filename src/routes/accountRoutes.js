const express = require('express');
const protect = require('../middleware/auth');
const { suggestUsersByEmail, addMemberToAccount } = require('../controller/accountController');

const router = express.Router();

// GET /account/users/suggest?q=par  -> suggest users by partial email
router.get('/users/suggest', protect, suggestUsersByEmail);

// POST /account/members { email }
router.post('/members', protect, addMemberToAccount);

module.exports = router;