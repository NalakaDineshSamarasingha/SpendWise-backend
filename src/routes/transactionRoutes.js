const express = require('express');
const protect = require('../middleware/auth');
const {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
} = require('../controller/transactionController');

const router = express.Router();

// Create
router.post('/transactions', protect, createTransaction);
// Read all
router.get('/transactions', protect,getTransactions);
// Read one
router.get('/transactions/:id', protect, getTransactionById);
// Update
router.put('/transactions/:id', protect, updateTransaction);
// Delete
router.delete('/transactions/:id', protect, deleteTransaction);

module.exports = router;
