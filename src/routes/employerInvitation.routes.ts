import { Router } from 'express';
import { invitationController } from '../controllers/invitation.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireEmployer } from '../middlewares/employerAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  validateInvitationCreate,
  validateInvitationIdParam,
  validateInvitationQuery,
} from '../middlewares/invitationValidate.middleware';

const employerInvitationRouter = Router();

employerInvitationRouter.use(authenticate, requireRole('employer'), requireEmployer);

employerInvitationRouter.post('/', validateInvitationCreate, (req, res, next) => {
  void invitationController.create(req, res, next);
});

employerInvitationRouter.get('/', validateInvitationQuery, (req, res, next) => {
  void invitationController.listEmployer(req, res, next);
});

employerInvitationRouter.patch('/:id/cancel', validateInvitationIdParam, (req, res, next) => {
  void invitationController.cancel(req, res, next);
});

export default employerInvitationRouter;
