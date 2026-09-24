import { Router, type Request } from 'express';
import { HTTP_STATUS } from '../constants';
import { jobController } from '../controllers/job.controller';
import { mediaController } from '../controllers/media.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireEmployer } from '../middlewares/employerAuth.middleware';
import { requireVideoJdEnabled } from '../middlewares/featureFlag.middleware';
import { validateObjectIdParam } from '../middlewares/objectIdParam.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { uploadSingle } from '../middlewares/upload.middleware';
import {
  validateEmployerJobQuery,
  validateJobBoostNotify,
  validateJobCreate,
  validateJobExtend,
  validateJobFeature,
  validateJobUrgentFlag,
  validateJobUpdate,
} from '../middlewares/jobValidate.middleware';
import { employerAiMatchingService } from '../services/employerAiMatching.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import { parseRequestSchema } from '../utils/validation';
import { employerJobMatchQuerySchema } from '../validators/employerAiMatching.validator';

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

employerJobRouter.post(
  '/:id/video-jd',
  validateObjectIdParam('id'),
  requireVideoJdEnabled,
  uploadSingle('file'),
  (req, res, next) => {
    void mediaController.uploadJobVideoJd(req, res, next);
  },
);

employerJobRouter.delete(
  '/:id/video-jd',
  validateObjectIdParam('id'),
  requireVideoJdEnabled,
  (req, res, next) => {
    void mediaController.deleteJobVideoJd(req, res, next);
  },
);

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

employerJobRouter.patch(
  '/:id/extend',
  validateObjectIdParam('id'),
  validateJobExtend,
  (req, res, next) => {
    void jobController.extend(req, res, next);
  },
);

employerJobRouter.patch('/:id/expire', validateObjectIdParam('id'), (req, res, next) => {
  void jobController.expire(req, res, next);
});

employerJobRouter.patch('/:id/republish', validateObjectIdParam('id'), (req, res, next) => {
  void jobController.republish(req, res, next);
});

employerJobRouter.patch(
  '/:id/feature',
  validateObjectIdParam('id'),
  validateJobFeature,
  (req, res, next) => {
    void jobController.setFeatured(req, res, next);
  },
);

employerJobRouter.patch(
  '/:id/urgent',
  validateObjectIdParam('id'),
  validateJobUrgentFlag,
  (req, res, next) => {
    void jobController.setUrgent(req, res, next);
  },
);

employerJobRouter.post(
  '/:id/boost-notify',
  validateObjectIdParam('id'),
  validateJobBoostNotify,
  (req, res, next) => {
    void jobController.notifyBoostMatches(req, res, next);
  },
);

employerJobRouter.get('/:id/boost-stats', validateObjectIdParam('id'), (req, res, next) => {
  void jobController.getBoostStats(req, res, next);
});

employerJobRouter.post('/:id/duplicate', validateObjectIdParam('id'), (req, res, next) => {
  void jobController.duplicate(req, res, next);
});

/**
 * AI Candidate Matching vs this JD (sheet 243–248).
 * Deterministic scores always; optional ChatGPT blurbs via withAiInsights=true.
 */
employerJobRouter.get(
  '/:id/matches',
  validateObjectIdParam('id'),
  (req, _res, next) => {
    const data = parseRequestSchema(employerJobMatchQuerySchema, req.query, next, 'query');
    if (!data) return;
    (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
    next();
  },
  async (req, res, next) => {
    try {
      if (!req.employer) throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const query = (req as Request & { validatedQuery: {
        minScore?: number;
        limit?: number;
        withAiInsights?: boolean;
      } }).validatedQuery;
      const data = await employerAiMatchingService.listMatchesForJob(req.employer, id, query);
      sendSuccess(res, data, 'Candidate matches fetched successfully');
    } catch (error) {
      next(error);
    }
  },
);

employerJobRouter.get(
  '/:id/matches/:candidateId/explain',
  validateObjectIdParam('id'),
  validateObjectIdParam('candidateId'),
  async (req, res, next) => {
    try {
      if (!req.employer) throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const candidateId =
        typeof req.params.candidateId === 'string' ? req.params.candidateId : '';
      const data = await employerAiMatchingService.explainMatch(req.employer, id, candidateId);
      sendSuccess(res, data, 'Match explanation fetched successfully');
    } catch (error) {
      next(error);
    }
  },
);

export default employerJobRouter;
