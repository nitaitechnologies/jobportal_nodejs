import { Router } from 'express';
import { adminContentController } from '../controllers/adminContent.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateBannerCreate,
  validateBannerIdParam,
  validateBannerQuery,
  validateBannerUpdate,
} from '../middlewares/adminContentValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', requirePermission(PERMISSIONS.ARTICLES_READ), validateBannerQuery, (req, res, next) => {
  void adminContentController.listBanners(req, res, next);
});
router.post('/', requirePermission(PERMISSIONS.ARTICLES_CREATE), validateBannerCreate, (req, res, next) => {
  void adminContentController.createBanner(req, res, next);
});
router.get('/:id', requirePermission(PERMISSIONS.ARTICLES_READ), validateBannerIdParam, (req, res, next) => {
  void adminContentController.getBanner(req, res, next);
});
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.ARTICLES_UPDATE),
  validateBannerIdParam,
  validateBannerUpdate,
  (req, res, next) => {
    void adminContentController.updateBanner(req, res, next);
  },
);
router.delete('/:id', requirePermission(PERMISSIONS.ARTICLES_DELETE), validateBannerIdParam, (req, res, next) => {
  void adminContentController.deleteBanner(req, res, next);
});

export default router;
