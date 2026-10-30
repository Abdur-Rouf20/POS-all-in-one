import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { listCategories, createCategory, updateCategory, deleteCategory } from '../controllers/categoryController.js';

const router = Router();
router.use(authenticate);
router.get('/', listCategories);
router.post('/', authorize('product.create'), createCategory);
router.put('/:id', authorize('product.update'), updateCategory);
router.delete('/:id', authorize('product.update'), deleteCategory);
export default router;
