import { Router } from 'express';
import { employerAuthController } from '../controllers/employerAuth.controller';
import { employerTeamController } from '../controllers/employerTeam.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireEmployer } from '../middlewares/employerAuth.middleware';
import { authRateLimiter } from '../middlewares/rateLimit.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validateObjectIdParam } from '../middlewares/objectIdParam.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import {
  employerLoginSchema,
  employerOtpSendSchema,
  employerOtpVerifySchema,
  employerRegisterSchema,
} from '../validators/employerAuth.validator';
import { employerTeamAcceptSchema } from '../validators/employerTeam.validator';

const employerAuthRouter = Router();

employerAuthRouter.post(
  '/register',
  authRateLimiter,
  validateBody(employerRegisterSchema),
  (req, res, next) => {
    void employerAuthController.register(req, res, next);
  },
);

employerAuthRouter.post(
  '/login',
  authRateLimiter,
  validateBody(employerLoginSchema),
  (req, res, next) => {
    void employerAuthController.login(req, res, next);
  },
);

employerAuthRouter.post(
  '/team/accept',
  authRateLimiter,
  validateBody(employerTeamAcceptSchema),
  (req, res, next) => {
    void employerTeamController.accept(req, res, next);
  },
);

employerAuthRouter.post(
  '/logout',
  authenticate,
  requireRole('employer'),
  requireEmployer,
  (req, res, next) => {
    void employerAuthController.logout(req, res, next);
  },
);

employerAuthRouter.get(
  '/me',
  authenticate,
  requireRole('employer'),
  requireEmployer,
  (req, res, next) => {
    void employerAuthController.me(req, res, next);
  },
);

employerAuthRouter.post(
  '/otp/send',
  authenticate,
  requireRole('employer'),
  requireEmployer,
  authRateLimiter,
  validateBody(employerOtpSendSchema),
  (req, res, next) => {
    void employerAuthController.sendOtp(req, res, next);
  },
);

employerAuthRouter.post(
  '/otp/verify',
  authenticate,
  requireRole('employer'),
  requireEmployer,
  authRateLimiter,
  validateBody(employerOtpVerifySchema),
  (req, res, next) => {
    void employerAuthController.verifyOtp(req, res, next);
  },
);

employerAuthRouter.get(
  '/sessions',
  authenticate,
  requireRole('employer'),
  requireEmployer,
  (req, res, next) => {
    void employerAuthController.listSessions(req, res, next);
  },
);

employerAuthRouter.post(
  '/sessions/revoke-others',
  authenticate,
  requireRole('employer'),
  requireEmployer,
  (req, res, next) => {
    void employerAuthController.revokeOtherSessions(req, res, next);
  },
);

employerAuthRouter.delete(
  '/sessions/:id',
  authenticate,
  requireRole('employer'),
  requireEmployer,
  validateObjectIdParam('id'),
  (req, res, next) => {
    void employerAuthController.revokeSession(req, res, next);
  },
);

export default employerAuthRouter;
