import { Router } from 'express';
import { jobController } from '../controllers/job.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireEmployer } from '../middlewares/employerAuth.middleware';
import { validateObjectIdParam } from '../middlewares/objectIdParam.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  validateEmployerJobQuery,
  validateJobCreate,
  validateJobUpdate,
} from '../middlewares/jobValidate.middleware';

/**
 * Employer-owned job management.
 * Ownership is always derived from the authenticated JWT identity.
 */
const employerJobRouter = Router();

employerJobRouter.use(authenticate, requireRole('employer'), requireEmployer);

employerJobRouter.post('/', validateJobCreate, (req, res, next) => {
  void jobController.create(req, res, next);
});

employerJobRouter.get('/', validateEmployerJobQuery, (req, res, next) => {
  void jobController.listEmployer(req, res, next);
});

employerJobRouter.get('/:id', validateObjectIdParam('id'), (req, res, next) => {
  void jobController.getEmployerById(req, res, next);
});

employerJobRouter.patch(
  '/:id',
  validateObjectIdParam('id'),
  validateJobUpdate,
  (req, res, next) => {
    void jobController.update(req, res, next);
  },
);

employerJobRouter.delete('/:id', validateObjectIdParam('id'), (req, res, next) => {
  void jobController.remove(req, res, next);
});

employerJobRouter.patch('/:id/publish', validateObjectIdParam('id'), (req, res, next) => {
  void jobController.publish(req, res, next);
});

employerJobRouter.patch('/:id/pause', validateObjectIdParam('id'), (req, res, next) => {
  void jobController.pause(req, res, next);
});

employerJobRouter.patch('/:id/resume', validateObjectIdParam('id'), (req, res, next) => {
  void jobController.resume(req, res, next);
});

employerJobRouter.patch('/:id/close', validateObjectIdParam('id'), (req, res, next) => {
  void jobController.close(req, res, next);
});

employerJobRouter.patch('/:id/renew', validateObjectIdParam('id'), (req, res, next) => {
  void jobController.renew(req, res, next);
});

export default employerJobRouter;
