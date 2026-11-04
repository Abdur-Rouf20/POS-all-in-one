import { Router } from 'express';
import { authenticate, resolveBranch } from '../middleware/auth.js';
import { getReport } from '../controllers/reportController.js';

const router = Router();
router.get('/', authenticate, resolveBranch({ allowAllForOwner: true }), getReport);
export default router;
