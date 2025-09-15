
const express = require("express");
const protect = require("../middleware/auth");
const { createAccount } = require("../controller/expensesController");
const router = express.Router();

// Example: get user expenses
router.get("/", protect, (req, res) => {
  res.json({ message: `Hello ${req.user.name}, your expenses list goes here` });
});

// Create a new account
router.post("/account", protect, createAccount);

module.exports = router;
