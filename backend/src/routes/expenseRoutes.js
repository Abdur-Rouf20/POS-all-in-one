import { Router } from 'express';
import { authenticate, resolveBranch } from '../middleware/auth.js';
import { createExpense, deleteExpense, listExpenses, updateExpense } from '../controllers/expenseController.js';

const router = Router();
router.use(authenticate, resolveBranch());
router.get('/', listExpenses);
router.post('/', createExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);
export default router;
