import { Router } from 'express';
import { listInvoicePayments } from '../controllers/paymentController.js';
import { authenticate, authorize, resolveBranch } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, resolveBranch());
// Invoice payments are accepted only when the invoice is created.
// Later customer collections must be recorded through Money Receipts.
router.get('/invoices/:id', authorize('invoice.view'), listInvoicePayments);

export default router;
