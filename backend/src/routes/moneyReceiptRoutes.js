import { Router } from 'express';
import { authenticate, authorize, resolveBranch } from '../middleware/auth.js';
import { createMoneyReceipt, listMoneyReceipts, getMoneyReceipt } from '../controllers/moneyReceiptController.js';
const router = Router();
router.use(authenticate, resolveBranch());
router.get('/', authorize('payment.receive'), listMoneyReceipts);
router.post('/', authorize('payment.receive'), createMoneyReceipt);
router.get('/:id', authorize('payment.receive'), getMoneyReceipt);
export default router;
