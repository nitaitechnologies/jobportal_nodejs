import { Router, type Request } from 'express';
import { HTTP_STATUS } from '../constants';
import { authenticate } from '../middlewares/auth.middleware';
import { requireEmployer } from '../middlewares/employerAuth.middleware';
import { requireVideoResumeEnabled } from '../middlewares/featureFlag.middleware';
import {
  validateEmployerCandidateDetailQuery,
  validateEmployerCandidateFolderCreate,
  validateEmployerCandidateFolderUpdate,
  validateEmployerCandidateIdParam,
  validateEmployerCandidateListQuery,
  validateEmployerCandidateRecontactCreate,
  validateEmployerCandidateRecontactQuery,
  validateEmployerCandidateSaveBody,
  validateEmployerCandidateSavedListQuery,
  validateEmployerCandidateSavedSearchCreate,
  validateEmployerCandidateTagsBody,
  validateEmployerCandidateUpdateSavedBody,
} from '../middlewares/employerCandidateValidate.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { employerCandidateService } from '../services/employerCandidate.service';
import { mediaUploadService } from '../services/mediaUpload.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  EmployerCandidateDetailQuery,
  EmployerCandidateListQuery,
  EmployerCandidateRecontactQuery,
  EmployerCandidateSavedListQuery,
} from '../validators/employerCandidate.validator';

const employerCandidateRouter = Router();

employerCandidateRouter.use(authenticate, requireRole('employer'), requireEmployer);

function requireEmployerContext(req: Request) {
  if (!req.employer) throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
  return req.employer;
}

function idParam(req: Request): string {
  return typeof req.params.id === 'string' ? req.params.id : '';
}

employerCandidateRouter.get('/', validateEmployerCandidateListQuery, async (req, res, next) => {
  try {
    const query = (req as Request & { validatedQuery: EmployerCandidateListQuery }).validatedQuery;
    const data = await employerCandidateService.list(requireEmployerContext(req), query);
    sendSuccess(res, data, 'Candidates fetched successfully');
  } catch (error) {
    next(error);
  }
});

employerCandidateRouter.get('/unlocks', validateEmployerCandidateSavedListQuery, async (req, res, next) => {
  try {
    const query = (req as Request & { validatedQuery: EmployerCandidateSavedListQuery }).validatedQuery;
    const data = await employerCandidateService.listUnlockHistory(requireEmployerContext(req), {
      page: query.page,
      limit: query.limit,
    });
    sendSuccess(res, data, 'Unlock history fetched successfully');
  } catch (error) {
    next(error);
  }
});

employerCandidateRouter.get('/saved-searches', async (req, res, next) => {
  try {
    const data = await employerCandidateService.listSavedSearches(requireEmployerContext(req));
    sendSuccess(res, data, 'Saved searches fetched successfully');
  } catch (error) {
    next(error);
  }
});

employerCandidateRouter.post(
  '/saved-searches',
  validateEmployerCandidateSavedSearchCreate,
  async (req, res, next) => {
    try {
      const data = await employerCandidateService.createSavedSearch(
        requireEmployerContext(req),
        req.body,
      );
      sendSuccess(res, data, 'Saved search created successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  },
);

employerCandidateRouter.delete(
  '/saved-searches/:id',
  validateEmployerCandidateIdParam,
  async (req, res, next) => {
    try {
      const data = await employerCandidateService.deleteSavedSearch(
        requireEmployerContext(req),
        idParam(req),
      );
      sendSuccess(res, data, 'Saved search deleted successfully');
    } catch (error) {
      next(error);
    }
  },
);

employerCandidateRouter.get('/folders', async (req, res, next) => {
  try {
    const data = await employerCandidateService.listFolders(requireEmployerContext(req));
    sendSuccess(res, data, 'Talent pool folders fetched successfully');
  } catch (error) {
    next(error);
  }
});

employerCandidateRouter.post(
  '/folders',
  validateEmployerCandidateFolderCreate,
  async (req, res, next) => {
    try {
      const data = await employerCandidateService.createFolder(requireEmployerContext(req), req.body);
      sendSuccess(res, data, 'Folder created successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  },
);

employerCandidateRouter.patch(
  '/folders/:id',
  validateEmployerCandidateIdParam,
  validateEmployerCandidateFolderUpdate,
  async (req, res, next) => {
    try {
      const data = await employerCandidateService.updateFolder(
        requireEmployerContext(req),
        idParam(req),
        req.body,
      );
      sendSuccess(res, data, 'Folder updated successfully');
    } catch (error) {
      next(error);
    }
  },
);

employerCandidateRouter.delete(
  '/folders/:id',
  validateEmployerCandidateIdParam,
  async (req, res, next) => {
    try {
      const data = await employerCandidateService.deleteFolder(
        requireEmployerContext(req),
        idParam(req),
      );
      sendSuccess(res, data, 'Folder deleted successfully');
    } catch (error) {
      next(error);
    }
  },
);

employerCandidateRouter.get(
  '/saved',
  validateEmployerCandidateSavedListQuery,
  async (req, res, next) => {
    try {
      const query = (req as Request & { validatedQuery: EmployerCandidateSavedListQuery })
        .validatedQuery;
      const data = await employerCandidateService.listSaved(requireEmployerContext(req), query);
      sendSuccess(res, data, 'Saved candidates fetched successfully');
    } catch (error) {
      next(error);
    }
  },
);

employerCandidateRouter.get(
  '/recontacts',
  validateEmployerCandidateRecontactQuery,
  async (req, res, next) => {
    try {
      const query = (req as Request & { validatedQuery: EmployerCandidateRecontactQuery })
        .validatedQuery;
      const data = await employerCandidateService.listRecontacts(requireEmployerContext(req), query);
      sendSuccess(res, data, 'Recontact reminders fetched successfully');
    } catch (error) {
      next(error);
    }
  },
);

employerCandidateRouter.post(
  '/recontacts',
  validateEmployerCandidateRecontactCreate,
  async (req, res, next) => {
    try {
      const data = await employerCandidateService.scheduleRecontact(
        requireEmployerContext(req),
        req.body,
      );
      sendSuccess(res, data, 'Recontact scheduled successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  },
);

employerCandidateRouter.delete(
  '/recontacts/:id',
  validateEmployerCandidateIdParam,
  async (req, res, next) => {
    try {
      const data = await employerCandidateService.cancelRecontact(
        requireEmployerContext(req),
        idParam(req),
      );
      sendSuccess(res, data, 'Recontact cancelled successfully');
    } catch (error) {
      next(error);
    }
  },
);

employerCandidateRouter.post(
  '/:id/save',
  validateEmployerCandidateIdParam,
  validateEmployerCandidateSaveBody,
  async (req, res, next) => {
    try {
      const data = await employerCandidateService.saveCandidate(
        requireEmployerContext(req),
        idParam(req),
        req.body,
      );
      sendSuccess(res, data, 'Candidate saved successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  },
);

employerCandidateRouter.patch(
  '/:id/save',
  validateEmployerCandidateIdParam,
  validateEmployerCandidateUpdateSavedBody,
  async (req, res, next) => {
    try {
      const data = await employerCandidateService.updateSaved(
        requireEmployerContext(req),
        idParam(req),
        req.body,
      );
      sendSuccess(res, data, 'Saved candidate updated successfully');
    } catch (error) {
      next(error);
    }
  },
);

employerCandidateRouter.delete(
  '/:id/save',
  validateEmployerCandidateIdParam,
  async (req, res, next) => {
    try {
      const data = await employerCandidateService.unsaveCandidate(
        requireEmployerContext(req),
        idParam(req),
      );
      sendSuccess(res, data, 'Candidate removed from talent pool successfully');
    } catch (error) {
      next(error);
    }
  },
);

employerCandidateRouter.patch(
  '/:id/tags',
  validateEmployerCandidateIdParam,
  validateEmployerCandidateTagsBody,
  async (req, res, next) => {
    try {
      const data = await employerCandidateService.setTags(
        requireEmployerContext(req),
        idParam(req),
        req.body,
      );
      sendSuccess(res, data, 'Tags updated successfully');
    } catch (error) {
      next(error);
    }
  },
);

employerCandidateRouter.post(
  '/:id/unlock-contact',
  validateEmployerCandidateIdParam,
  async (req, res, next) => {
    try {
      const data = await employerCandidateService.unlockContact(
        requireEmployerContext(req),
        idParam(req),
      );
      sendSuccess(res, data, 'Contact unlocked successfully');
    } catch (error) {
      next(error);
    }
  },
);

employerCandidateRouter.get(
  '/:id/resume/download',
  validateEmployerCandidateIdParam,
  async (req, res, next) => {
    try {
      const { media, buffer } = await mediaUploadService.downloadCandidateResumeForEmployer(
        requireEmployerContext(req),
        idParam(req),
      );
      res.setHeader('Content-Type', media.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${media.originalName || 'resume'}"`,
      );
      res.setHeader('Content-Length', String(buffer.length));
      res.status(HTTP_STATUS.OK).send(buffer);
    } catch (error) {
      next(error);
    }
  },
);

employerCandidateRouter.get(
  '/:id/video-resume/download',
  validateEmployerCandidateIdParam,
  requireVideoResumeEnabled,
  async (req, res, next) => {
    try {
      const { media, buffer } = await mediaUploadService.downloadCandidateVideoResumeForEmployer(
        requireEmployerContext(req),
        idParam(req),
      );
      res.setHeader('Content-Type', media.mimeType);
      res.setHeader('Content-Disposition', 'inline; filename="video-resume"');
      res.setHeader('Content-Length', String(buffer.length));
      res.status(HTTP_STATUS.OK).send(buffer);
    } catch (error) {
      next(error);
    }
  },
);

employerCandidateRouter.get(
  '/:id',
  validateEmployerCandidateIdParam,
  validateEmployerCandidateDetailQuery,
  async (req, res, next) => {
    try {
      const query = (req as Request & { validatedQuery: EmployerCandidateDetailQuery }).validatedQuery;
      const data = await employerCandidateService.getById(
        requireEmployerContext(req),
        idParam(req),
        query.jobId,
      );
      sendSuccess(res, data, 'Candidate fetched successfully');
    } catch (error) {
      next(error);
    }
  },
);

export default employerCandidateRouter;
