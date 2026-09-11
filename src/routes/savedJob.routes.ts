import { Router } from 'express';
import { savedJobController } from '../controllers/savedJob.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCandidate } from '../middlewares/candidateAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  validateSavedJobIdParam,
  validateSavedJobListQuery,
} from '../middlewares/savedJobValidate.middleware';

/**
 * Candidate saved-jobs management.
 * Ownership is always derived from the authenticated JWT identity.
 */
const savedJobRouter = Router();

savedJobRouter.use(authenticate, requireRole('candidate'), requireCandidate);

savedJobRouter.get('/', validateSavedJobListQuery, (req, res, next) => {
  void savedJobController.list(req, res, next);
});

savedJobRouter.get('/:jobId', validateSavedJobIdParam, (req, res, next) => {
  void savedJobController.getStatus(req, res, next);
});

savedJobRouter.post('/:jobId', validateSavedJobIdParam, (req, res, next) => {
  void savedJobController.save(req, res, next);
});

savedJobRouter.delete('/:jobId', validateSavedJobIdParam, (req, res, next) => {
  void savedJobController.unsave(req, res, next);
});

savedJobRouter.patch('/:jobId/toggle', validateSavedJobIdParam, (req, res, next) => {
  void savedJobController.toggle(req, res, next);
});

export default savedJobRouter;
