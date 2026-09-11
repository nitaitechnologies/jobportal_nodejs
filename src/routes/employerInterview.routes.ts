import { Router } from 'express';
import { interviewController } from '../controllers/interview.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireEmployer } from '../middlewares/employerAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  validateEmployerInterviewQuery,
  validateInterviewCancel,
  validateInterviewCreate,
  validateInterviewIdParam,
  validateInterviewReschedule,
  validateInterviewUpdate,
} from '../middlewares/interviewValidate.middleware';

const employerInterviewRouter = Router();

employerInterviewRouter.use(authenticate, requireRole('employer'), requireEmployer);

employerInterviewRouter.post('/', validateInterviewCreate, (req, res, next) => {
  void interviewController.create(req, res, next);
});

employerInterviewRouter.get('/', validateEmployerInterviewQuery, (req, res, next) => {
  void interviewController.listEmployer(req, res, next);
});

employerInterviewRouter.get('/:id', validateInterviewIdParam, (req, res, next) => {
  void interviewController.getEmployerById(req, res, next);
});

employerInterviewRouter.patch(
  '/:id',
  validateInterviewIdParam,
  validateInterviewUpdate,
  (req, res, next) => {
    void interviewController.update(req, res, next);
  },
);

employerInterviewRouter.patch(
  '/:id/reschedule',
  validateInterviewIdParam,
  validateInterviewReschedule,
  (req, res, next) => {
    void interviewController.reschedule(req, res, next);
  },
);

employerInterviewRouter.patch(
  '/:id/cancel',
  validateInterviewIdParam,
  validateInterviewCancel,
  (req, res, next) => {
    void interviewController.cancel(req, res, next);
  },
);

employerInterviewRouter.patch('/:id/complete', validateInterviewIdParam, (req, res, next) => {
  void interviewController.complete(req, res, next);
});

export default employerInterviewRouter;
