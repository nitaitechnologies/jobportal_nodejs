import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { roleAdService } from '../services/roleAd.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  RoleAdClickQuery,
  RoleAdCreateInput,
  RoleAdQuery,
  RoleAdSuggestQuery,
  RoleAdUpdateInput,
} from '../validators/roleAd.validator';

type RequestWithQuery<T> = Request & { validatedQuery?: T };

function idParam(req: Request): string {
  return typeof req.params.id === 'string' ? req.params.id : '';
}

function requireCandidate(req: Request) {
  if (!req.candidate) {
    throw new AppError('Candidate access required', HTTP_STATUS.FORBIDDEN);
  }
  return req.candidate;
}

export class RoleAdController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithQuery<RoleAdQuery>).validatedQuery as RoleAdQuery;
      sendSuccess(res, await roleAdService.list(query), 'Role ads fetched');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await roleAdService.getById(idParam(req)), 'Role ad fetched');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await roleAdService.create(req.body as RoleAdCreateInput);
      sendSuccess(res, data, 'Role ad created', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await roleAdService.update(idParam(req), req.body as RoleAdUpdateInput);
      sendSuccess(res, data, 'Role ad updated');
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await roleAdService.remove(idParam(req)), 'Role ad deleted');
    } catch (error) {
      next(error);
    }
  }

  async clicks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithQuery<RoleAdClickQuery>).validatedQuery as RoleAdClickQuery;
      sendSuccess(res, await roleAdService.listClicks(idParam(req), query), 'Role ad clicks fetched');
    } catch (error) {
      next(error);
    }
  }

  async suggest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithQuery<RoleAdSuggestQuery>).validatedQuery as RoleAdSuggestQuery;
      const skills = query.skills
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean);
      const ads = await roleAdService.findLiveForSkills(skills);
      sendSuccess(res, { ads }, 'Role ads fetched');
    } catch (error) {
      next(error);
    }
  }

  async click(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await roleAdService.recordClick(requireCandidate(req), idParam(req));
      sendSuccess(res, data, 'Role ad click recorded');
    } catch (error) {
      next(error);
    }
  }
}

export const roleAdController = new RoleAdController();
