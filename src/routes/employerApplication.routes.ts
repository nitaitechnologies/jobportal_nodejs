import { Router } from 'express';
import { applicationController } from '../controllers/application.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireEmployer } from '../middlewares/employerAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  validateApplicationIdParam,
  validateApplicationStatusUpdate,
  validateEmployerApplicationQuery,
} from '../middlewares/applicationValidate.middleware';

const employerApplicationRouter = Router();

employerApplicationRouter.use(authenticate, requireRole('employer'), requireEmployer);

employerApplicationRouter.get('/', validateEmployerApplicationQuery, (req, res, next) => {
  void applicationController.listEmployer(req, res, next);
});

employerApplicationRouter.get('/:id', validateApplicationIdParam, (req, res, next) => {
  void applicationController.getEmployerById(req, res, next);
});

employerApplicationRouter.patch(
  '/:id/status',
  validateApplicationIdParam,
  validateApplicationStatusUpdate,
  (req, res, next) => {
    void applicationController.updateStatus(req, res, next);
  },
);

export default employerApplicationRouter;
