import { Router } from 'express';
import { adminContentController } from '../controllers/adminContent.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateJobSeekerTestimonialCreate,
  validateJobSeekerTestimonialIdParam,
  validateJobSeekerTestimonialQuery,
  validateJobSeekerTestimonialUpdate,
} from '../middlewares/adminContentValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate, requireAdmin);

router.get(
  '/',
  requirePermission(PERMISSIONS.ARTICLES_READ),
  validateJobSeekerTestimonialQuery,
  (req, res, next) => {
    void adminContentController.listJobSeekerTestimonials(req, res, next);
  },
);
router.post(
  '/',
  requirePermission(PERMISSIONS.ARTICLES_CREATE),
  validateJobSeekerTestimonialCreate,
  (req, res, next) => {
    void adminContentController.createJobSeekerTestimonial(req, res, next);
  },
);
router.get(
  '/:id',
  requirePermission(PERMISSIONS.ARTICLES_READ),
  validateJobSeekerTestimonialIdParam,
  (req, res, next) => {
    void adminContentController.getJobSeekerTestimonial(req, res, next);
  },
);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.ARTICLES_UPDATE),
  validateJobSeekerTestimonialIdParam,
  validateJobSeekerTestimonialUpdate,
  (req, res, next) => {
    void adminContentController.updateJobSeekerTestimonial(req, res, next);
  },
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.ARTICLES_DELETE),
  validateJobSeekerTestimonialIdParam,
  (req, res, next) => {
    void adminContentController.deleteJobSeekerTestimonial(req, res, next);
  },
);

export default router;
