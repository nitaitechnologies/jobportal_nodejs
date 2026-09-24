import { Router } from 'express';
import { companyController } from '../controllers/company.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCandidate } from '../middlewares/candidateAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  validateCompanyJobsQuery,
  validateCompanyReviewCreate,
  validateCompanyReviewsQuery,
  validateCompanyReviewUpdate,
} from '../middlewares/companyPublicValidate.middleware';

/**
 * Public company routes (+ candidate review mutations).
 * Visibility: status=active and verificationStatus != rejected.
 */
const companyRouter = Router();

companyRouter.get('/featured', (req, res, next) => {
  void companyController.listPublicFeatured(req, res, next);
});

companyRouter.get('/:slug/jobs', validateCompanyJobsQuery, (req, res, next) => {
  void companyController.listPublicJobs(req, res, next);
});

companyRouter.get('/:slug/reviews', validateCompanyReviewsQuery, (req, res, next) => {
  void companyController.listReviews(req, res, next);
});

companyRouter.post(
  '/:slug/reviews',
  authenticate,
  requireRole('candidate'),
  requireCandidate,
  validateCompanyReviewCreate,
  (req, res, next) => {
    void companyController.upsertReview(req, res, next);
  },
);

companyRouter.patch(
  '/reviews/:id',
  authenticate,
  requireRole('candidate'),
  requireCandidate,
  validateCompanyReviewUpdate,
  (req, res, next) => {
    void companyController.updateReview(req, res, next);
  },
);

companyRouter.delete(
  '/reviews/:id',
  authenticate,
  requireRole('candidate'),
  requireCandidate,
  (req, res, next) => {
    void companyController.deleteReview(req, res, next);
  },
);

companyRouter.get('/:slug', (req, res, next) => {
  void companyController.getPublicBySlug(req, res, next);
});

export default companyRouter;
