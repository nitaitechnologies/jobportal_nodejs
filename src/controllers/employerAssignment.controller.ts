import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import {
  employerAssignmentService,
  type AssignApplicationInput,
  type AssignJobAssigneesInput,
} from '../services/employerAssignment.service';
import { listCompanyActivity } from '../services/companyActivity.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import '../types/express';

export class EmployerAssignmentController {
  async assignJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.employer) {
        throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
      }
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const result = await employerAssignmentService.assignJob(
        req.employer,
        id,
        req.body as AssignJobAssigneesInput,
      );
      sendSuccess(res, result, 'Job assignees updated');
    } catch (error) {
      next(error);
    }
  }

  async assignApplication(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.employer) {
        throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
      }
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const result = await employerAssignmentService.assignApplication(
        req.employer,
        id,
        req.body as AssignApplicationInput,
      );
      sendSuccess(res, result, 'Application assignee updated');
    } catch (error) {
      next(error);
    }
  }

  async listActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.employer) {
        throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
      }
      const query = (req as Request & {
        validatedQuery?: { page: number; limit: number };
      }).validatedQuery ?? { page: 1, limit: 20 };
      const result = await listCompanyActivity(req.employer, query);
      sendSuccess(res, result, 'Team activity fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const employerAssignmentController = new EmployerAssignmentController();
