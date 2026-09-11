import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { mediaUploadService } from '../services/mediaUpload.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import { requireUploadedFile } from '../middlewares/upload.middleware';

function requireCandidate(req: Request) {
  if (!req.candidate) throw new AppError('Candidate access required', HTTP_STATUS.FORBIDDEN);
  return req.candidate;
}

function requireEmployer(req: Request) {
  if (!req.employer) throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
  return req.employer;
}

function requireAdmin(req: Request) {
  if (!req.admin) throw new AppError('Admin access required', HTTP_STATUS.FORBIDDEN);
  return req.admin;
}

function idParam(req: Request): string {
  return typeof req.params.id === 'string' ? req.params.id : '';
}

export class MediaController {
  async uploadCandidateAvatar(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await mediaUploadService.uploadCandidateAvatar(
        requireCandidate(req),
        requireUploadedFile(req),
      );
      sendSuccess(res, data, 'Avatar uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteCandidateAvatar(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await mediaUploadService.deleteCandidateAvatar(requireCandidate(req));
      sendSuccess(res, data, 'Avatar deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async uploadCandidateResume(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await mediaUploadService.uploadCandidateResume(
        requireCandidate(req),
        requireUploadedFile(req),
      );
      sendSuccess(res, data, 'Resume uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCandidateResume(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await mediaUploadService.getCandidateResume(requireCandidate(req));
      sendSuccess(res, data, 'Resume fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async downloadCandidateResume(req: Request, res: Response, next: NextFunction) {
    try {
      const { media, buffer } = await mediaUploadService.downloadCandidateResume(
        requireCandidate(req),
      );
      res.setHeader('Content-Type', media.mimeType);
      const safeName = media.originalName
        .replace(/[^\w.\- ()[\]]+/g, '_')
        .replace(/"/g, '')
        .slice(0, 180);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeName || 'resume'}"`,
      );
      res.setHeader('Content-Length', String(buffer.length));
      res.status(HTTP_STATUS.OK).send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async deleteCandidateResume(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await mediaUploadService.deleteCandidateResume(requireCandidate(req));
      sendSuccess(res, data, 'Resume deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async uploadCompanyLogo(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await mediaUploadService.uploadCompanyLogo(
        requireEmployer(req),
        requireUploadedFile(req),
      );
      sendSuccess(res, data, 'Company logo uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteCompanyLogo(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await mediaUploadService.deleteCompanyLogo(requireEmployer(req));
      sendSuccess(res, data, 'Company logo deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async uploadCompanyCover(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await mediaUploadService.uploadCompanyCover(
        requireEmployer(req),
        requireUploadedFile(req),
      );
      sendSuccess(res, data, 'Company cover image uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteCompanyCover(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await mediaUploadService.deleteCompanyCover(requireEmployer(req));
      sendSuccess(res, data, 'Company cover image deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async uploadArticleImage(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await mediaUploadService.uploadArticleImage(
        requireAdmin(req),
        idParam(req),
        requireUploadedFile(req),
      );
      sendSuccess(res, data, 'Article image uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteArticleImage(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await mediaUploadService.deleteArticleImage(requireAdmin(req), idParam(req));
      sendSuccess(res, data, 'Article image deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async streamPublic(req: Request, res: Response, next: NextFunction) {
    try {
      const { media, buffer } = await mediaUploadService.streamPublicMedia(idParam(req));
      res.setHeader('Content-Type', media.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Length', String(buffer.length));
      res.status(HTTP_STATUS.OK).send(buffer);
    } catch (error) {
      next(error);
    }
  }
}

export const mediaController = new MediaController();
