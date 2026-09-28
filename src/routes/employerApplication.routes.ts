import { Router } from 'express';
import { EMPLOYER_PERMISSIONS } from '../constants/employerPermissions';
import { applicationController } from '../controllers/application.controller';
import { employerAssignmentController } from '../controllers/employerAssignment.controller';
import { mediaController } from '../controllers/media.controller';
import { authenticate } from '../middlewares/auth.middleware';
import {
  requireEmployer,
  requireEmployerPermission,
} from '../middlewares/employerAuth.middleware';
import { requireVideoResumeEnabled } from '../middlewares/featureFlag.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import {
  validateApplicationBulkMessage,
  validateApplicationBulkStatus,
  validateApplicationIdParam,
  validateApplicationInternalRating,
  validateApplicationNoteIdParam,
  validateApplicationNotesUpdate,
  validateApplicationStatusUpdate,
  validateEmployerApplicationExportQuery,
  validateEmployerApplicationQuery,
  validateEmployerApplicationStatsQuery,
} from '../middlewares/applicationValidate.middleware';
import { assignApplicationSchema } from '../services/employerAssignment.service';

const employerApplicationRouter = Router();

employerApplicationRouter.use(authenticate, requireRole('employer'), requireEmployer);

employerApplicationRouter.get('/', validateEmployerApplicationQuery, (req, res, next) => {
  void applicationController.listEmployer(req, res, next);
});

employerApplicationRouter.get(
  '/stats',
  validateEmployerApplicationStatsQuery,
  (req, res, next) => {
    void applicationController.getEmployerStats(req, res, next);
  },
);

employerApplicationRouter.get(
  '/export',
  validateEmployerApplicationExportQuery,
  (req, res, next) => {
    void applicationController.exportEmployerCsv(req, res, next);
  },
);

employerApplicationRouter.post(
  '/bulk-status',
  validateApplicationBulkStatus,
  (req, res, next) => {
    void applicationController.bulkUpdateStatus(req, res, next);
  },
);

employerApplicationRouter.post(
  '/bulk-message',
  validateApplicationBulkMessage,
  (req, res, next) => {
    void applicationController.bulkMessage(req, res, next);
  },
);

employerApplicationRouter.get('/:id', validateApplicationIdParam, (req, res, next) => {
  void applicationController.getEmployerById(req, res, next);
});

employerApplicationRouter.get(
  '/:id/video-resume/download',
  validateApplicationIdParam,
  requireVideoResumeEnabled,
  (req, res, next) => {
    void mediaController.downloadApplicationVideoResumeEmployer(req, res, next);
  },
);

employerApplicationRouter.patch(
  '/:id/status',
  validateApplicationIdParam,
  validateApplicationStatusUpdate,
  (req, res, next) => {
    void applicationController.updateStatus(req, res, next);
  },
);

/** Assign a recruiter to an application (sheet 338). */
employerApplicationRouter.patch(
  '/:id/assign',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.APPLICATIONS_MANAGE),
  validateApplicationIdParam,
  validateBody(assignApplicationSchema),
  (req, res, next) => {
    void employerAssignmentController.assignApplication(req, res, next);
  },
);

employerApplicationRouter.post(
  '/:id/notes',
  validateApplicationIdParam,
  validateApplicationNotesUpdate,
  (req, res, next) => {
    void applicationController.addNote(req, res, next);
  },
);

employerApplicationRouter.patch(
  '/:id/rating',
  validateApplicationIdParam,
  validateApplicationInternalRating,
  (req, res, next) => {
    void applicationController.setInternalRating(req, res, next);
  },
);

employerApplicationRouter.patch(
  '/:id/notes/:noteId',
  validateApplicationNoteIdParam,
  validateApplicationNotesUpdate,
  (req, res, next) => {
    void applicationController.updateNote(req, res, next);
  },
);

employerApplicationRouter.delete(
  '/:id/notes/:noteId',
  validateApplicationNoteIdParam,
  (req, res, next) => {
    void applicationController.deleteNote(req, res, next);
  },
);

export default employerApplicationRouter;
