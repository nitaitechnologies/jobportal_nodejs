import { Router } from 'express';
import { aiMatchingController } from '../controllers/aiMatching.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCandidate } from '../middlewares/candidateAuth.middleware';
import {
  requireAiCareerCoachEnabled,
  requireAiMatchingEnabled,
} from '../middlewares/featureFlag.middleware';
import { aiCoachRateLimiter } from '../middlewares/rateLimit.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  validateAiMatchJobIdParam,
  validateAiMatchListQuery,
} from '../middlewares/aiMatchingValidate.middleware';

/**
 * Candidate AI matching (102, 107) + career coach (109–112).
 */
const candidateAiRouter = Router();

candidateAiRouter.use(authenticate, requireRole('candidate'), requireCandidate);

candidateAiRouter.get(
  '/matches',
  requireAiMatchingEnabled,
  aiCoachRateLimiter,
  validateAiMatchListQuery,
  (req, res, next) => {
    void aiMatchingController.listMatches(req, res, next);
  },
);

candidateAiRouter.get(
  '/matches/:jobId/explain',
  requireAiMatchingEnabled,
  aiCoachRateLimiter,
  validateAiMatchJobIdParam,
  (req, res, next) => {
    void aiMatchingController.explainMatch(req, res, next);
  },
);

candidateAiRouter.get(
  '/career-coach',
  requireAiCareerCoachEnabled,
  aiCoachRateLimiter,
  (req, res, next) => {
    void aiMatchingController.careerCoach(req, res, next);
  },
);

export default candidateAiRouter;
