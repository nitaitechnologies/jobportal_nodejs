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
      const data = await jobService.getPublicBySlug(slug);
      sendSuccess(res, data, 'Job fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const jobController = new JobController();
