import { Router } from 'express';
import { employerTeamController } from '../controllers/employerTeam.controller';
import { authenticate } from '../middlewares/auth.middleware';
import {
  requireEmployer,
  requireEmployerPermission,
} from '../middlewares/employerAuth.middleware';
import { validateObjectIdParam } from '../middlewares/objectIdParam.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { EMPLOYER_PERMISSIONS } from '../constants/employerPermissions';
import {
  employerTeamInviteSchema,
  employerTeamRoleUpdateSchema,
} from '../validators/employerTeam.validator';

const employerTeamRouter = Router();

employerTeamRouter.use(authenticate, requireRole('employer'), requireEmployer);

employerTeamRouter.get('/', (req, res, next) => {
  void employerTeamController.list(req, res, next);
});

employerTeamRouter.post(
  '/invite',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.INVITES_MANAGE),
  validateBody(employerTeamInviteSchema),
  (req, res, next) => {
    void employerTeamController.invite(req, res, next);
  },
);

employerTeamRouter.delete(
  '/invites/:id',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.INVITES_MANAGE),
  validateObjectIdParam('id'),
  (req, res, next) => {
    void employerTeamController.revokeInvite(req, res, next);
  },
);

employerTeamRouter.patch(
  '/:id/role',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.TEAM_MANAGE),
  validateObjectIdParam('id'),
  validateBody(employerTeamRoleUpdateSchema),
  (req, res, next) => {
    void employerTeamController.updateRole(req, res, next);
  },
);

employerTeamRouter.delete(
  '/:id',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.TEAM_MANAGE),
  validateObjectIdParam('id'),
  (req, res, next) => {
    void employerTeamController.removeMember(req, res, next);
  },
);

export default employerTeamRouter;
