import { Router } from 'express';
import { employerAuthController } from '../controllers/employerAuth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireEmployer } from '../middlewares/employerAuth.middleware';
import { authRateLimiter } from '../middlewares/rateLimit.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import {
  employerLoginSchema,
  employerRegisterSchema,
} from '../validators/employerAuth.validator';

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

export default employerAuthRouter;
