import { Router } from 'express';
import { adminAuthController } from '../controllers/adminAuth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/adminAuth.middleware';
import { authRateLimiter } from '../middlewares/rateLimit.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { adminLoginSchema } from '../validators/adminAuth.validator';

const adminAuthRouter = Router();

adminAuthRouter.post(
  '/login',
  authRateLimiter,
  validateBody(adminLoginSchema),
  (req, res, next) => {
    void adminAuthController.login(req, res, next);
  },
);

adminAuthRouter.post(
  '/logout',
  authenticate,
  requireAdmin,
  (req, res, next) => {
    void adminAuthController.logout(req, res, next);
  },
);

adminAuthRouter.get(
  '/me',
  authenticate,
  requireAdmin,
  (req, res, next) => {
    void adminAuthController.me(req, res, next);
  },
);

export default adminAuthRouter;
