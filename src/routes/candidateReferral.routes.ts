import { Router } from 'express';
import { referralController } from '../controllers/referral.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCandidate } from '../middlewares/candidateAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';

const candidateReferralRouter = Router();

candidateReferralRouter.use(authenticate, requireRole('candidate'), requireCandidate);

candidateReferralRouter.get('/', (req, res, next) => {
  void referralController.candidateMine(req, res, next);
});

export default candidateReferralRouter;
