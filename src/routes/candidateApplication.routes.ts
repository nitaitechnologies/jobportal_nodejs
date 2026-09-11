import { Router } from 'express';
import { applicationController } from '../controllers/application.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCandidate } from '../middlewares/candidateAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  validateApplicationIdParam,
  validateCandidateApplicationQuery,
} from '../middlewares/applicationValidate.middleware';

const candidateApplicationRouter = Router();

candidateApplicationRouter.use(authenticate, requireRole('candidate'), requireCandidate);

candidateApplicationRouter.get('/', validateCandidateApplicationQuery, (req, res, next) => {
  void applicationController.listCandidate(req, res, next);
});

candidateApplicationRouter.get('/:id', validateApplicationIdParam, (req, res, next) => {
  void applicationController.getCandidateById(req, res, next);
});

candidateApplicationRouter.patch(
  '/:id/withdraw',
  validateApplicationIdParam,
  (req, res, next) => {
    void applicationController.withdraw(req, res, next);
  },
);

export default candidateApplicationRouter;
