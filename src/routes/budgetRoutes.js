const express = require('express');
const protect = require('../middleware/auth');
const {
  createBudget,
  getBudgets,
  getBudgetById,
  updateBudget,
  deleteBudget,
} = require('../controller/budgetController');

const router = express.Router();

router.post('/', protect, createBudget);
router.get('/', protect, getBudgets);
router.get('/:id', protect, getBudgetById);
router.put('/:id', protect, updateBudget);
router.delete('/:id', protect, deleteBudget);

module.exports = router;
