import { Router } from 'express';
import { employerAiRecruitmentController } from '../controllers/employerAiRecruitment.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireEmployer } from '../middlewares/employerAuth.middleware';
import { requireAiRecruitmentEnabled } from '../middlewares/featureFlag.middleware';
import {
  validateGenerateInterviewQuestions,
  validateGenerateMessage,
  validateImproveJd,
  validateSaveInterviewQuestions,
  validateScreenCandidates,
  validateSuggestCandidates,
  validateSuggestSkills,
  validateSummarizeProfile,
} from '../middlewares/employerAiRecruitmentValidate.middleware';
import { aiRecruitmentRateLimiter } from '../middlewares/rateLimit.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validateObjectIdParam } from '../middlewares/objectIdParam.middleware';

/**
 * Employer AI Recruitment Assistant + AI Interview (sheet 293–303).
 */
const employerAiRouter = Router();

employerAiRouter.use(
  authenticate,
  requireRole('employer'),
  requireEmployer,
  requireAiRecruitmentEnabled,
  aiRecruitmentRateLimiter,
);

employerAiRouter.post('/jd/improve', validateImproveJd, (req, res, next) => {
  void employerAiRecruitmentController.improveJd(req, res, next);
});

employerAiRouter.post('/skills/suggest', validateSuggestSkills, (req, res, next) => {
  void employerAiRecruitmentController.suggestSkills(req, res, next);
});

employerAiRouter.post('/candidates/screen', validateScreenCandidates, (req, res, next) => {
  void employerAiRecruitmentController.screenCandidates(req, res, next);
});

employerAiRouter.post('/profiles/summarize', validateSummarizeProfile, (req, res, next) => {
  void employerAiRecruitmentController.summarizeProfile(req, res, next);
});

employerAiRouter.post('/candidates/suggest', validateSuggestCandidates, (req, res, next) => {
  void employerAiRecruitmentController.suggestCandidates(req, res, next);
});

employerAiRouter.post(
  '/interview/questions',
  validateGenerateInterviewQuestions,
  (req, res, next) => {
    void employerAiRecruitmentController.generateInterviewQuestions(req, res, next);
  },
);

employerAiRouter.put(
  '/interview/questions/save',
  validateSaveInterviewQuestions,
  (req, res, next) => {
    void employerAiRecruitmentController.saveInterviewQuestions(req, res, next);
  },
);

employerAiRouter.get(
  '/interview/questions/:jobId',
  validateObjectIdParam('jobId'),
  (req, res, next) => {
    void employerAiRecruitmentController.getSavedInterviewQuestions(req, res, next);
  },
);

employerAiRouter.post('/messages/selection', validateGenerateMessage, (req, res, next) => {
  void employerAiRecruitmentController.generateSelectionMessage(req, res, next);
});

employerAiRouter.post('/messages/rejection', validateGenerateMessage, (req, res, next) => {
  void employerAiRecruitmentController.generateRejectionMessage(req, res, next);
});

export default employerAiRouter;
