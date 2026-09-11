import { NextFunction, Request, Response } from 'express';
import { Candidate } from '../models/Candidate';
import { User } from '../models/User';
import { HTTP_STATUS } from '../constants';
import type { AuthenticatedCandidate } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import '../types/express';

/**
 * Authorization: ensure authenticated identity is an active candidate.
 * Must run after authenticate().
 */
export async function requireCandidate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.auth) {
      throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
    }

    if (req.auth.role !== 'candidate') {
      throw new AppError('Candidate access required', HTTP_STATUS.FORBIDDEN);
    }

    const [user, candidate] = await Promise.all([
      User.findById(req.auth.userId).select('name email phone role status deletedAt'),
      Candidate.findOne({ userId: req.auth.userId }).select('_id profileCompletion profileVisibility'),
    ]);

    if (!user || user.role !== 'candidate' || user.status !== 'active' || user.deletedAt) {
      throw new AppError('Candidate access denied', HTTP_STATUS.FORBIDDEN);
    }

    if (!candidate) {
      throw new AppError('Candidate access denied', HTTP_STATUS.FORBIDDEN);
    }

    const context: AuthenticatedCandidate = {
      userId: user._id.toString(),
      candidateId: candidate._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      role: 'candidate',
      status: user.status,
    };

    req.candidate = context;
    next();
  } catch (error) {
    next(error);
  }
}
