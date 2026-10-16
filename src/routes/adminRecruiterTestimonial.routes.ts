import { Router } from 'express';
import { adminContentController } from '../controllers/adminContent.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateRecruiterTestimonialCreate,
  validateRecruiterTestimonialIdParam,
  validateRecruiterTestimonialQuery,
  validateRecruiterTestimonialUpdate,
} from '../middlewares/adminContentValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate, requireAdmin);

router.get(
  '/',
  requirePermission(PERMISSIONS.ARTICLES_READ),
  validateRecruiterTestimonialQuery,
  (req, res, next) => {
    void adminContentController.listRecruiterTestimonials(req, res, next);
  },
);
router.post(
  '/',
  requirePermission(PERMISSIONS.ARTICLES_CREATE),
  validateRecruiterTestimonialCreate,
  (req, res, next) => {
    void adminContentController.createRecruiterTestimonial(req, res, next);
  },
);
router.get(
  '/:id',
  requirePermission(PERMISSIONS.ARTICLES_READ),
  validateRecruiterTestimonialIdParam,
  (req, res, next) => {
    void adminContentController.getRecruiterTestimonial(req, res, next);
  },
);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.ARTICLES_UPDATE),
  validateRecruiterTestimonialIdParam,
  validateRecruiterTestimonialUpdate,
  (req, res, next) => {
    void adminContentController.updateRecruiterTestimonial(req, res, next);
  },
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.ARTICLES_DELETE),
  validateRecruiterTestimonialIdParam,
  (req, res, next) => {
    void adminContentController.deleteRecruiterTestimonial(req, res, next);
  },
);

export default router;
