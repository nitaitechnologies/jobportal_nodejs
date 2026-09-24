import { Router } from 'express';
import { adminContentController } from '../controllers/adminContent.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateFaqCreate,
  validateFaqIdParam,
  validateFaqQuery,
  validateFaqUpdate,
} from '../middlewares/adminContentValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', requirePermission(PERMISSIONS.ARTICLES_READ), validateFaqQuery, (req, res, next) => {
  void adminContentController.listFaqs(req, res, next);
});
router.post('/', requirePermission(PERMISSIONS.ARTICLES_CREATE), validateFaqCreate, (req, res, next) => {
  void adminContentController.createFaq(req, res, next);
});
router.get('/:id', requirePermission(PERMISSIONS.ARTICLES_READ), validateFaqIdParam, (req, res, next) => {
  void adminContentController.getFaq(req, res, next);
});
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.ARTICLES_UPDATE),
  validateFaqIdParam,
  validateFaqUpdate,
  (req, res, next) => {
    void adminContentController.updateFaq(req, res, next);
  },
);
router.delete('/:id', requirePermission(PERMISSIONS.ARTICLES_DELETE), validateFaqIdParam, (req, res, next) => {
  void adminContentController.deleteFaq(req, res, next);
});

export default router;
