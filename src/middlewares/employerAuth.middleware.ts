import { NextFunction, Request, Response } from 'express';
import { Company } from '../models/Company';
import { Employer } from '../models/Employer';
import { User } from '../models/User';
import { HTTP_STATUS } from '../constants';
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
      User.findById(req.auth.userId).select('name email phone role status deletedAt'),
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

    const context: AuthenticatedEmployer = {
      userId: user._id.toString(),
      employerId: employer._id.toString(),
      companyId: employer.companyId.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      role: 'employer',
      status: user.status,
    };

    req.employer = context;
    next();
  } catch (error) {
    next(error);
  }
}
