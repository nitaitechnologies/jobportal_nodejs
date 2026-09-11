import { Router } from 'express';
import { applicationController } from '../controllers/application.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCandidate } from '../middlewares/candidateAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  validateApplicationApply,
  validateJobIdParam,
} from '../middlewares/applicationValidate.middleware';

const candidateApplyRouter = Router();

candidateApplyRouter.use(authenticate, requireRole('candidate'), requireCandidate);

candidateApplyRouter.post(
  '/:jobId/apply',
  validateJobIdParam,
  validateApplicationApply,
  (req, res, next) => {
    void applicationController.apply(req, res, next);
  },
);

export default candidateApplyRouter;
