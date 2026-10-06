import { Router } from 'express';
import { roleAdController } from '../controllers/roleAd.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCandidate } from '../middlewares/candidateAuth.middleware';
import {
  validateRoleAdIdParam,
  validateRoleAdSuggestQuery,
} from '../middlewares/roleAdValidate.middleware';
import { requireRole } from '../middlewares/role.middleware';

/**
 * Candidate role ads — website and mobile app.
 * Suggest by skill/role labels; click records total + per-user counts.
 */
const candidateRoleAdRouter = Router();

candidateRoleAdRouter.use(authenticate, requireRole('candidate'), requireCandidate);

candidateRoleAdRouter.get('/', validateRoleAdSuggestQuery, (req, res, next) => {
  void roleAdController.suggest(req, res, next);
});

candidateRoleAdRouter.post('/:id/click', validateRoleAdIdParam, (req, res, next) => {
  void roleAdController.click(req, res, next);
});

export default candidateRoleAdRouter;
