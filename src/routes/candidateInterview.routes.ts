import { Router } from 'express';
import { interviewController } from '../controllers/interview.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCandidate } from '../middlewares/candidateAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  validateCandidateInterviewQuery,
  validateInterviewDecline,
  validateInterviewIdParam,
} from '../middlewares/interviewValidate.middleware';

const candidateInterviewRouter = Router();

candidateInterviewRouter.use(authenticate, requireRole('candidate'), requireCandidate);

candidateInterviewRouter.get('/', validateCandidateInterviewQuery, (req, res, next) => {
  void interviewController.listCandidate(req, res, next);
});

candidateInterviewRouter.get('/:id', validateInterviewIdParam, (req, res, next) => {
  void interviewController.getCandidateById(req, res, next);
});

candidateInterviewRouter.patch('/:id/confirm', validateInterviewIdParam, (req, res, next) => {
  void interviewController.confirm(req, res, next);
});

candidateInterviewRouter.patch(
  '/:id/decline',
  validateInterviewIdParam,
  validateInterviewDecline,
  (req, res, next) => {
    void interviewController.decline(req, res, next);
  },
);

export default candidateInterviewRouter;
