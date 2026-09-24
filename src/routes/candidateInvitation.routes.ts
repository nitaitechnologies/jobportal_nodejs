import { Router } from 'express';
import { invitationController } from '../controllers/invitation.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCandidate } from '../middlewares/candidateAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  validateInvitationIdParam,
  validateInvitationQuery,
} from '../middlewares/invitationValidate.middleware';

const candidateInvitationRouter = Router();

candidateInvitationRouter.use(authenticate, requireRole('candidate'), requireCandidate);

candidateInvitationRouter.get('/', validateInvitationQuery, (req, res, next) => {
  void invitationController.listCandidate(req, res, next);
});

candidateInvitationRouter.get('/:id', validateInvitationIdParam, (req, res, next) => {
  void invitationController.getCandidateById(req, res, next);
});

candidateInvitationRouter.patch('/:id/accept', validateInvitationIdParam, (req, res, next) => {
  void invitationController.accept(req, res, next);
});

candidateInvitationRouter.patch('/:id/decline', validateInvitationIdParam, (req, res, next) => {
  void invitationController.decline(req, res, next);
});

export default candidateInvitationRouter;
