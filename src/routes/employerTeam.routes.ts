import { Router } from 'express';
import { z } from 'zod';
import { employerAssignmentController } from '../controllers/employerAssignment.controller';
import { employerTeamController } from '../controllers/employerTeam.controller';
import { EMPLOYER_PERMISSIONS } from '../constants/employerPermissions';
import { authenticate } from '../middlewares/auth.middleware';
import {
  requireEmployer,
  requireEmployerPermission,
} from '../middlewares/employerAuth.middleware';
import { validateObjectIdParam } from '../middlewares/objectIdParam.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { parseRequestSchema } from '../utils/validation';
import {
  employerTeamInviteSchema,
  employerTeamRoleUpdateSchema,
} from '../validators/employerTeam.validator';

const activityQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .strict();

const employerTeamRouter = Router();

employerTeamRouter.use(authenticate, requireRole('employer'), requireEmployer);

employerTeamRouter.get('/', (req, res, next) => {
  void employerTeamController.list(req, res, next);
});

employerTeamRouter.get('/activity', (req, res, next) => {
  const data = parseRequestSchema(activityQuerySchema, req.query, next, 'query');
  if (!data) return;
  (req as typeof req & { validatedQuery?: unknown }).validatedQuery = data;
  void employerAssignmentController.listActivity(req, res, next);
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
