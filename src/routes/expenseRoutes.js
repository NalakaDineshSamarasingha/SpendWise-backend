const express = require("express");
const protect = require("../middleware/auth");
const router = express.Router();

// Example: get user expenses
router.get("/", protect, (req, res) => {
  res.json({ message: `Hello ${req.user.name}, your expenses list goes here` });
});

module.exports = router;
