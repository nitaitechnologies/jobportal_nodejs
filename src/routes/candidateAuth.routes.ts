import { Router } from 'express';
import { candidateAuthController } from '../controllers/candidateAuth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCandidate } from '../middlewares/candidateAuth.middleware';
import { authRateLimiter } from '../middlewares/rateLimit.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import {
  candidateAccountDeleteSchema,
  candidateLoginSchema,
  candidateOtpSendSchema,
  candidateOtpVerifySchema,
  candidatePasswordForgotSchema,
  candidatePasswordResetSchema,
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
  '/otp/send',
  authRateLimiter,
  validateBody(candidateOtpSendSchema),
  (req, res, next) => {
    void candidateAuthController.sendOtp(req, res, next);
  },
);

candidateAuthRouter.post(
  '/otp/verify',
  authRateLimiter,
  validateBody(candidateOtpVerifySchema),
  (req, res, next) => {
    void candidateAuthController.verifyOtp(req, res, next);
  },
);

candidateAuthRouter.post(
  '/password/forgot',
  authRateLimiter,
  validateBody(candidatePasswordForgotSchema),
  (req, res, next) => {
    void candidateAuthController.forgotPassword(req, res, next);
  },
);

candidateAuthRouter.post(
  '/password/reset',
  authRateLimiter,
  validateBody(candidatePasswordResetSchema),
  (req, res, next) => {
    void candidateAuthController.resetPassword(req, res, next);
  },
);

candidateAuthRouter.post(
  '/deactivate',
  authenticate,
  requireRole('candidate'),
  requireCandidate,
  authRateLimiter,
  (req, res, next) => {
    void candidateAuthController.deactivate(req, res, next);
  },
);

candidateAuthRouter.post(
  '/account/delete',
  authenticate,
  requireRole('candidate'),
  requireCandidate,
  authRateLimiter,
  validateBody(candidateAccountDeleteSchema),
  (req, res, next) => {
    void candidateAuthController.deleteAccount(req, res, next);
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
