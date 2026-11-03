import { Router } from 'express';
import { listSalesReturns, getSalesReturn, createSalesReturn } from '../controllers/salesReturnController.js';
import { authenticate, authorize, resolveBranch } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, resolveBranch());
router.get('/', authorize('invoice.view'), listSalesReturns);
router.get('/:id', authorize('invoice.view'), getSalesReturn);
router.post('/', authorize('invoice.create'), createSalesReturn);
export default router;
