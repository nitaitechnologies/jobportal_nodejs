import { Router } from 'express';
import { adminContentController } from '../controllers/adminContent.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateTaxonomyCreate,
  validateTaxonomyIdParam,
  validateTaxonomyQuery,
  validateTaxonomyUpdate,
} from '../middlewares/adminContentValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', requirePermission(PERMISSIONS.CATEGORIES_READ), validateTaxonomyQuery, (req, res, next) => {
  void adminContentController.listTaxonomy(req, res, next);
});
router.post('/', requirePermission(PERMISSIONS.CATEGORIES_CREATE), validateTaxonomyCreate, (req, res, next) => {
  void adminContentController.createTaxonomy(req, res, next);
});
router.get('/:id', requirePermission(PERMISSIONS.CATEGORIES_READ), validateTaxonomyIdParam, (req, res, next) => {
  void adminContentController.getTaxonomy(req, res, next);
});
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.CATEGORIES_UPDATE),
  validateTaxonomyIdParam,
  validateTaxonomyUpdate,
  (req, res, next) => {
    void adminContentController.updateTaxonomy(req, res, next);
  },
);
router.delete('/:id', requirePermission(PERMISSIONS.CATEGORIES_DELETE), validateTaxonomyIdParam, (req, res, next) => {
  void adminContentController.deleteTaxonomy(req, res, next);
});

export default router;
