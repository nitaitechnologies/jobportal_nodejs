import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { jobService } from '../services/job.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  EmployerJobQuery,
  JobCreateInput,
  JobUpdateInput,
  PublicJobQuery,
} from '../validators/job.validator';

type RequestWithValidatedQuery = Request & {
  validatedQuery?: EmployerJobQuery | PublicJobQuery;
};

function requireEmployerContext(req: Request) {
  if (!req.employer) {
    throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
  }
  return req.employer;
}

export class JobController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await jobService.create(
        requireEmployerContext(req),
        req.body as JobCreateInput,
      );
      sendSuccess(res, data, 'Job created successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async listEmployer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as EmployerJobQuery;
      const data = await jobService.listEmployer(requireEmployerContext(req), query);
      sendSuccess(res, data, 'Jobs fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getEmployerById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await jobService.getEmployerById(requireEmployerContext(req), id);
      sendSuccess(res, data, 'Job fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await jobService.update(
        requireEmployerContext(req),
        id,
        req.body as JobUpdateInput,
      );
      sendSuccess(res, data, 'Job updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await jobService.remove(requireEmployerContext(req), id);
      sendSuccess(res, data, 'Job deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async publish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await jobService.publish(requireEmployerContext(req), id);
      sendSuccess(res, data, 'Job published successfully');
    } catch (error) {
      next(error);
    }
  }

  async pause(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await jobService.pause(requireEmployerContext(req), id);
      sendSuccess(res, data, 'Job paused successfully');
    } catch (error) {
      next(error);
    }
  }

  async resume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await jobService.resume(requireEmployerContext(req), id);
      sendSuccess(res, data, 'Job resumed successfully');
    } catch (error) {
      next(error);
    }
  }

  async close(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await jobService.close(requireEmployerContext(req), id);
      sendSuccess(res, data, 'Job closed successfully');
    } catch (error) {
      next(error);
    }
  }

  async renew(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await jobService.renew(requireEmployerContext(req), id);
      sendSuccess(res, data, 'Job renewed successfully');
    } catch (error) {
      next(error);
    }
  }

  async extend(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const days = (req.body as { days?: number })?.days;
      const data = await jobService.extend(requireEmployerContext(req), id, days);
      sendSuccess(res, data, 'Job listing extended successfully');
    } catch (error) {
      next(error);
    }
  }

  async expire(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await jobService.expire(requireEmployerContext(req), id);
      sendSuccess(res, data, 'Job expired successfully');
    } catch (error) {
      next(error);
    }
  }

  async republish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await jobService.republish(requireEmployerContext(req), id);
      sendSuccess(res, data, 'Job republished successfully');
    } catch (error) {
      next(error);
    }
  }

  async setFeatured(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const featured = Boolean((req.body as { featured: boolean }).featured);
      const data = await jobService.setFeatured(
        requireEmployerContext(req),
        id,
        featured,
      );
      sendSuccess(res, data, featured ? 'Job featured successfully' : 'Featured flag removed');
    } catch (error) {
      next(error);
    }
  }

  async setUrgent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const urgent = Boolean((req.body as { urgent: boolean }).urgent);
      const data = await jobService.setUrgent(requireEmployerContext(req), id, urgent);
      sendSuccess(res, data, urgent ? 'Job marked urgent' : 'Urgent flag removed');
    } catch (error) {
      next(error);
    }
  }

  async notifyBoostMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const body = (req.body ?? {}) as { minScore?: number; limit?: number };
      const data = await jobService.notifyBoostMatches(requireEmployerContext(req), id, {
        minScore: body.minScore,
        limit: body.limit,
      });
      sendSuccess(res, data, `Boost notify sent to ${data.sent} matching candidate(s)`);
    } catch (error) {
      next(error);
    }
  }

  async getBoostStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await jobService.getBoostStats(requireEmployerContext(req), id);
      sendSuccess(res, data, 'Boost performance fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async duplicate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await jobService.duplicate(requireEmployerContext(req), id);
      sendSuccess(res, data, 'Job duplicated as draft', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async listPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as PublicJobQuery;
      const data = await jobService.listPublic(query);
      sendSuccess(res, data, 'Jobs fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPublicBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = typeof req.params.slug === 'string' ? req.params.slug : '';
      const latRaw = Number(req.query.lat);
      const lngRaw = Number(req.query.lng);
      const geo =
        Number.isFinite(latRaw) && Number.isFinite(lngRaw)
          ? { lat: latRaw, lng: lngRaw }
          : undefined;
      const data = await jobService.getPublicBySlug(slug, geo);
      sendSuccess(res, data, 'Job fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const jobController = new JobController();
