import { Router } from 'express';
import { candidateSafetyController } from '../controllers/candidateSafety.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCandidate } from '../middlewares/candidateAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  validateBlockEmployer,
  validateCandidateDocumentSubmit,
} from '../middlewares/candidateSafetyValidate.middleware';

/**
 * Candidate trust & safety (sheet 141–148 supporting APIs).
 * Independent of chat feature flag so block always works.
 */
const candidateSafetyRouter = Router();

candidateSafetyRouter.use(authenticate, requireRole('candidate'), requireCandidate);

candidateSafetyRouter.get('/blocked-employers', (req, res, next) => {
  void candidateSafetyController.listBlocked(req, res, next);
});

candidateSafetyRouter.post('/block-employer', validateBlockEmployer, (req, res, next) => {
  void candidateSafetyController.blockEmployer(req, res, next);
});

candidateSafetyRouter.post('/unblock-employer', validateBlockEmployer, (req, res, next) => {
  void candidateSafetyController.unblockEmployer(req, res, next);
});

candidateSafetyRouter.get('/verification', (req, res, next) => {
  void candidateSafetyController.getVerification(req, res, next);
});

candidateSafetyRouter.post(
  '/verification/documents',
  validateCandidateDocumentSubmit,
  (req, res, next) => {
    void candidateSafetyController.submitDocument(req, res, next);
  },
);

export default candidateSafetyRouter;
