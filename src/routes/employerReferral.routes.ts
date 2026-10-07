import { Router } from 'express';
import { referralController } from '../controllers/referral.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireEmployer } from '../middlewares/employerAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';

const employerReferralRouter = Router();

employerReferralRouter.use(authenticate, requireRole('employer'), requireEmployer);

employerReferralRouter.get('/', (req, res, next) => {
  void referralController.employerMine(req, res, next);
});

export default employerReferralRouter;
