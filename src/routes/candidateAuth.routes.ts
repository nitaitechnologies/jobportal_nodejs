import { Router } from 'express';
import { candidateAuthController } from '../controllers/candidateAuth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCandidate } from '../middlewares/candidateAuth.middleware';
import { authRateLimiter } from '../middlewares/rateLimit.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import {
  candidateLoginSchema,
  candidateRegisterSchema,
} from '../validators/candidateAuth.validator';

const candidateAuthRouter = Router();

candidateAuthRouter.post(
  '/register',
  authRateLimiter,
  validateBody(candidateRegisterSchema),
  (req, res, next) => {
    void candidateAuthController.register(req, res, next);
  },
);

candidateAuthRouter.post(
  '/login',
  authRateLimiter,
  validateBody(candidateLoginSchema),
  (req, res, next) => {
    void candidateAuthController.login(req, res, next);
  },
);

candidateAuthRouter.post(
  '/logout',
  authenticate,
  requireRole('candidate'),
  requireCandidate,
  (req, res, next) => {
    void candidateAuthController.logout(req, res, next);
  },
);

candidateAuthRouter.get(
  '/me',
  authenticate,
  requireRole('candidate'),
  requireCandidate,
  (req, res, next) => {
    void candidateAuthController.me(req, res, next);
  },
);

export default candidateAuthRouter;
