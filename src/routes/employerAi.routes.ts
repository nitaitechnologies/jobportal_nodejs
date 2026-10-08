import { Router } from 'express';
import { employerAiRecruitmentController } from '../controllers/employerAiRecruitment.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireEmployer } from '../middlewares/employerAuth.middleware';
import { requireAiFeature } from '../middlewares/featureFlag.middleware';
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
  aiRecruitmentRateLimiter,
);

employerAiRouter.post(
  '/jd/improve',
  requireAiFeature('aiJdImproveEnabled'),
  validateImproveJd,
  (req, res, next) => {
    void employerAiRecruitmentController.improveJd(req, res, next);
  },
);

employerAiRouter.post(
  '/skills/suggest',
  requireAiFeature('aiSkillSuggestEnabled'),
  validateSuggestSkills,
  (req, res, next) => {
    void employerAiRecruitmentController.suggestSkills(req, res, next);
  },
);

employerAiRouter.post(
  '/candidates/screen',
  requireAiFeature('aiCandidateScreenEnabled'),
  validateScreenCandidates,
  (req, res, next) => {
    void employerAiRecruitmentController.screenCandidates(req, res, next);
  },
);

employerAiRouter.post(
  '/profiles/summarize',
  requireAiFeature('aiProfileSummaryEnabled'),
  validateSummarizeProfile,
  (req, res, next) => {
    void employerAiRecruitmentController.summarizeProfile(req, res, next);
  },
);

employerAiRouter.post(
  '/candidates/suggest',
  requireAiFeature('aiCandidateSuggestEnabled'),
  validateSuggestCandidates,
  (req, res, next) => {
    void employerAiRecruitmentController.suggestCandidates(req, res, next);
  },
);

employerAiRouter.post(
  '/interview/questions',
  requireAiFeature('aiInterviewQuestionsEnabled'),
  validateGenerateInterviewQuestions,
  (req, res, next) => {
    void employerAiRecruitmentController.generateInterviewQuestions(req, res, next);
  },
);

employerAiRouter.put(
  '/interview/questions/save',
  requireAiFeature('aiInterviewQuestionsEnabled'),
  validateSaveInterviewQuestions,
  (req, res, next) => {
    void employerAiRecruitmentController.saveInterviewQuestions(req, res, next);
  },
);

employerAiRouter.get(
  '/interview/questions/:jobId',
  requireAiFeature('aiInterviewQuestionsEnabled'),
  validateObjectIdParam('jobId'),
  (req, res, next) => {
    void employerAiRecruitmentController.getSavedInterviewQuestions(req, res, next);
  },
);

employerAiRouter.post(
  '/messages/selection',
  requireAiFeature('aiSelectionMessageEnabled'),
  validateGenerateMessage,
  (req, res, next) => {
    void employerAiRecruitmentController.generateSelectionMessage(req, res, next);
  },
);

employerAiRouter.post(
  '/messages/rejection',
  requireAiFeature('aiRejectionMessageEnabled'),
  validateGenerateMessage,
  (req, res, next) => {
    void employerAiRecruitmentController.generateRejectionMessage(req, res, next);
  },
);

export default employerAiRouter;
