import { Router } from 'express';
import { applicationController } from '../controllers/application.controller';
import { mediaController } from '../controllers/media.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCandidate } from '../middlewares/candidateAuth.middleware';
import { requireVideoResumeEnabled } from '../middlewares/featureFlag.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { uploadSingle } from '../middlewares/upload.middleware';
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

candidateApplicationRouter.post(
  '/:id/video-resume',
  validateApplicationIdParam,
  requireVideoResumeEnabled,
  uploadSingle('file'),
  (req, res, next) => {
    void mediaController.uploadApplicationVideoResume(req, res, next);
  },
);

candidateApplicationRouter.get(
  '/:id/video-resume/download',
  validateApplicationIdParam,
  requireVideoResumeEnabled,
  (req, res, next) => {
    void mediaController.downloadApplicationVideoResumeCandidate(req, res, next);
  },
);

candidateApplicationRouter.delete(
  '/:id/video-resume',
  validateApplicationIdParam,
  requireVideoResumeEnabled,
  (req, res, next) => {
    void mediaController.deleteApplicationVideoResume(req, res, next);
  },
);

candidateApplicationRouter.patch(
  '/:id/withdraw',
  validateApplicationIdParam,
  (req, res, next) => {
    void applicationController.withdraw(req, res, next);
  },
);

export default candidateApplicationRouter;
