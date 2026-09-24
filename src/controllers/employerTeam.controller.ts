import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { employerTeamService } from '../services/employerTeam.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  EmployerTeamAcceptInput,
  EmployerTeamInviteInput,
  EmployerTeamRoleUpdateInput,
} from '../validators/employerTeam.validator';
import '../types/express';

export class EmployerTeamController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.employer) {
        throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
      }
      const [members, invites] = await Promise.all([
        employerTeamService.listMembers(req.employer),
        employerTeamService.listInvites(req.employer),
      ]);
      sendSuccess(res, { ...members, ...invites }, 'Team fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async invite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.employer) {
        throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
      }
      const result = await employerTeamService.invite(
        req.employer,
        req.body as EmployerTeamInviteInput,
      );
      sendSuccess(res, result, 'Invite created successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async revokeInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.employer) {
        throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
      }
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const result = await employerTeamService.revokeInvite(req.employer, id);
      sendSuccess(res, result, 'Invite revoked');
    } catch (error) {
      next(error);
    }
  }

  async accept(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await employerTeamService.acceptInvite(req.body as EmployerTeamAcceptInput, {
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '',
        ip: req.ip || '',
      });
      sendSuccess(res, result, 'Joined company successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.employer) {
        throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
      }
      const body = req.body as EmployerTeamRoleUpdateInput;
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const result = await employerTeamService.updateMemberRole(
        req.employer,
        id,
        body.teamRole,
      );
      sendSuccess(res, result, 'Role updated');
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.employer) {
        throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
      }
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const result = await employerTeamService.removeMember(req.employer, id);
      sendSuccess(res, result, 'Team member removed');
    } catch (error) {
      next(error);
    }
  }
}

export const employerTeamController = new EmployerTeamController();
