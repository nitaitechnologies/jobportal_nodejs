import { Router } from 'express';
import { careerAdviceController } from '../controllers/careerAdvice.controller';
import { mediaController } from '../controllers/media.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import { uploadSingle } from '../middlewares/upload.middleware';
import {
  validateAdminCareerAdviceQuery,
  validateCareerArticleCreate,
  validateCareerArticleIdParam,
  validateCareerArticleUpdate,
} from '../middlewares/careerAdviceValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const adminCareerAdviceRouter = Router();

adminCareerAdviceRouter.use(authenticate, requireAdmin);

adminCareerAdviceRouter.post(
  '/',
  requirePermission(PERMISSIONS.ARTICLES_CREATE),
  validateCareerArticleCreate,
  (req, res, next) => {
    void careerAdviceController.create(req, res, next);
  },
);

adminCareerAdviceRouter.get(
  '/',
  requirePermission(PERMISSIONS.ARTICLES_READ),
  validateAdminCareerAdviceQuery,
  (req, res, next) => {
    void careerAdviceController.listAdmin(req, res, next);
  },
);

adminCareerAdviceRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.ARTICLES_READ),
  validateCareerArticleIdParam,
  (req, res, next) => {
    void careerAdviceController.getAdminById(req, res, next);
  },
);

adminCareerAdviceRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.ARTICLES_UPDATE),
  validateCareerArticleIdParam,
  validateCareerArticleUpdate,
  (req, res, next) => {
    void careerAdviceController.update(req, res, next);
  },
);

adminCareerAdviceRouter.post(
  '/:id/image',
  requirePermission(PERMISSIONS.ARTICLES_UPDATE),
  validateCareerArticleIdParam,
  uploadSingle('file'),
  (req, res, next) => {
    void mediaController.uploadArticleImage(req, res, next);
  },
);

adminCareerAdviceRouter.delete(
  '/:id/image',
  requirePermission(PERMISSIONS.ARTICLES_UPDATE),
  validateCareerArticleIdParam,
  (req, res, next) => {
    void mediaController.deleteArticleImage(req, res, next);
  },
);

adminCareerAdviceRouter.patch(
  '/:id/publish',
  requirePermission(PERMISSIONS.ARTICLES_PUBLISH),
  validateCareerArticleIdParam,
  (req, res, next) => {
    void careerAdviceController.publish(req, res, next);
  },
);

adminCareerAdviceRouter.patch(
  '/:id/unpublish',
  requirePermission(PERMISSIONS.ARTICLES_PUBLISH),
  validateCareerArticleIdParam,
  (req, res, next) => {
    void careerAdviceController.unpublish(req, res, next);
  },
);

adminCareerAdviceRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.ARTICLES_DELETE),
  validateCareerArticleIdParam,
  (req, res, next) => {
    void careerAdviceController.archive(req, res, next);
  },
);

export default adminCareerAdviceRouter;
