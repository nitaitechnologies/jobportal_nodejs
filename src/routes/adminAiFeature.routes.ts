import { Router } from 'express';
import { PERMISSIONS } from '../constants/permissions';
import { adminAiFeatureController } from '../controllers/adminAiFeature.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { adminAiFeatureUpdateSchema } from '../validators/adminAiFeature.validator';

const adminAiFeatureRouter = Router();

adminAiFeatureRouter.use(authenticate, requireAdmin);

adminAiFeatureRouter.get('/', requirePermission(PERMISSIONS.SETTINGS_READ), (req, res, next) => {
  void adminAiFeatureController.list(req, res, next);
});

adminAiFeatureRouter.patch(
  '/',
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  validateBody(adminAiFeatureUpdateSchema),
  (req, res, next) => {
    void adminAiFeatureController.update(req, res, next);
  },
);

export default adminAiFeatureRouter;
