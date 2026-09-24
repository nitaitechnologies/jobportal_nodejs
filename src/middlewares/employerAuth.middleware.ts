import { NextFunction, Request, Response } from 'express';
import { Company } from '../models/Company';
import { Employer } from '../models/Employer';
import { User } from '../models/User';
import { HTTP_STATUS } from '../constants';
import type { EmployerTeamRole } from '../constants/enums';
import {
  permissionsForTeamRole,
  type EmployerPermission,
  teamRoleHasPermission,
} from '../constants/employerPermissions';
import type { AuthenticatedEmployer } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import '../types/express';

/**
 * Authorization: ensure authenticated identity is an active employer.
 * Must run after authenticate().
 */
export async function requireEmployer(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.auth) {
      throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
    }

    if (req.auth.role !== 'employer') {
      throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
    }

    const [user, employer] = await Promise.all([
      User.findById(req.auth.userId).select(
        'name email phone role status deletedAt phoneVerified emailVerified',
      ),
      Employer.findOne({ userId: req.auth.userId }),
    ]);

    if (!user || user.role !== 'employer' || user.status !== 'active' || user.deletedAt) {
      throw new AppError('Employer access denied', HTTP_STATUS.FORBIDDEN);
    }

    if (!employer || employer.status !== 'active' || !employer.companyId) {
      throw new AppError('Employer access denied', HTTP_STATUS.FORBIDDEN);
    }

    const company = await Company.findById(employer.companyId).select('_id status');
    if (!company || company.status === 'suspended') {
      throw new AppError('Employer access denied', HTTP_STATUS.FORBIDDEN);
    }

    const teamRole = (employer.teamRole as EmployerTeamRole) || 'owner';

    const context: AuthenticatedEmployer = {
      userId: user._id.toString(),
      employerId: employer._id.toString(),
      companyId: employer.companyId.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      role: 'employer',
      teamRole,
      permissions: permissionsForTeamRole(teamRole),
      status: user.status,
      sessionId: req.auth.sessionId,
      phoneVerified: Boolean(user.phoneVerified),
      emailVerified: Boolean(user.emailVerified),
    };

    req.employer = context;
    next();
  } catch (error) {
    next(error);
  }
}

/** Gate employer routes by company-scoped permission (sheet 162). */
export function requireEmployerPermission(permission: EmployerPermission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const employer = req.employer;
      if (!employer) {
        throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
      }
      if (!teamRoleHasPermission(employer.teamRole, permission)) {
        throw new AppError(
          'Your role does not allow this action. Ask a company owner or HR.',
          HTTP_STATUS.FORBIDDEN,
        );
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
