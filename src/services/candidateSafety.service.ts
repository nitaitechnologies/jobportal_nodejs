import mongoose from 'mongoose';
import { Company } from '../models/Company';
import { Employer } from '../models/Employer';
import { User } from '../models/User';
import { UserBlock } from '../models/UserBlock';
import { HTTP_STATUS } from '../constants';
import type { AuthenticatedCandidate } from '../types/auth.types';
import { AppError } from '../utils/AppError';

export type BlockEmployerInput = {
  employerId?: string;
  companyId?: string;
  userId?: string;
  reason?: string;
};

/**
 * Candidate trust & safety: block employers outside chat (sheet 143).
 * Resolves employer/company → employer userId, then uses UserBlock.
 */
export class CandidateSafetyService {
  private async resolveEmployerUserId(input: BlockEmployerInput): Promise<{
    employerUserId: string;
    employerId: string;
    companyId: string | null;
    companyName: string;
  }> {
    if (input.userId) {
      const user = await User.findById(input.userId).select('role status deletedAt');
      if (!user || user.role !== 'employer' || user.deletedAt) {
        throw new AppError('Employer not found', HTTP_STATUS.NOT_FOUND);
      }
      const employer = await Employer.findOne({ userId: user._id });
      if (!employer) {
        throw new AppError('Employer not found', HTTP_STATUS.NOT_FOUND);
      }
      const company = employer.companyId
        ? await Company.findById(employer.companyId).select('name')
        : null;
      return {
        employerUserId: user._id.toString(),
        employerId: employer._id.toString(),
        companyId: employer.companyId ? employer.companyId.toString() : null,
        companyName: company?.name ?? 'Employer',
      };
    }

    if (input.employerId) {
      if (!mongoose.isValidObjectId(input.employerId)) {
        throw new AppError('Invalid employer id', HTTP_STATUS.BAD_REQUEST);
      }
      const employer = await Employer.findById(input.employerId);
      if (!employer) {
        throw new AppError('Employer not found', HTTP_STATUS.NOT_FOUND);
      }
      const company = employer.companyId
        ? await Company.findById(employer.companyId).select('name')
        : null;
      return {
        employerUserId: employer.userId.toString(),
        employerId: employer._id.toString(),
        companyId: employer.companyId ? employer.companyId.toString() : null,
        companyName: company?.name ?? 'Employer',
      };
    }

    if (input.companyId) {
      if (!mongoose.isValidObjectId(input.companyId)) {
        throw new AppError('Invalid company id', HTTP_STATUS.BAD_REQUEST);
      }
      const company = await Company.findById(input.companyId);
      if (!company) {
        throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);
      }
      const employer = await Employer.findOne({ companyId: company._id }).sort({ createdAt: 1 });
      if (!employer) {
        throw new AppError('Employer not found for this company', HTTP_STATUS.NOT_FOUND);
      }
      return {
        employerUserId: employer.userId.toString(),
        employerId: employer._id.toString(),
        companyId: company._id.toString(),
        companyName: company.name,
      };
    }

    throw new AppError(
      'Provide employerId, companyId, or userId',
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  async blockEmployer(candidate: AuthenticatedCandidate, input: BlockEmployerInput) {
    const resolved = await this.resolveEmployerUserId(input);
    if (resolved.employerUserId === candidate.userId) {
      throw new AppError('Cannot block yourself', HTTP_STATUS.BAD_REQUEST);
    }

    await UserBlock.findOneAndUpdate(
      { blockerId: candidate.userId, blockedId: resolved.employerUserId },
      {
        $set: {
          reason: (input.reason ?? '').trim().slice(0, 500),
        },
        $setOnInsert: {
          blockerId: candidate.userId,
          blockedId: resolved.employerUserId,
        },
      },
      { upsert: true, new: true },
    );

    return {
      blocked: true as const,
      employerId: resolved.employerId,
      companyId: resolved.companyId,
      companyName: resolved.companyName,
      userId: resolved.employerUserId,
    };
  }

  async unblockEmployer(candidate: AuthenticatedCandidate, input: BlockEmployerInput) {
    const resolved = await this.resolveEmployerUserId(input);
    await UserBlock.deleteOne({
      blockerId: candidate.userId,
      blockedId: resolved.employerUserId,
    });
    return { blocked: false as const, userId: resolved.employerUserId };
  }

  async listBlockedEmployers(candidate: AuthenticatedCandidate) {
    const rows = await UserBlock.find({ blockerId: candidate.userId }).sort({ createdAt: -1 });
    const blockedUserIds = rows.map((r) => r.blockedId);
    const employers = await Employer.find({ userId: { $in: blockedUserIds } });
    const companyIds = employers
      .map((e) => e.companyId)
      .filter(Boolean) as mongoose.Types.ObjectId[];
    const companies = await Company.find({ _id: { $in: companyIds } }).select('name slug logo');
    const companyById = new Map(companies.map((c) => [c._id.toString(), c]));
    const employerByUser = new Map(employers.map((e) => [e.userId.toString(), e]));

    return {
      blocked: rows
        .map((row) => {
          const employer = employerByUser.get(row.blockedId.toString());
          if (!employer) return null;
          const company = employer.companyId
            ? companyById.get(employer.companyId.toString())
            : null;
          return {
            userId: row.blockedId.toString(),
            employerId: employer._id.toString(),
            companyId: employer.companyId ? employer.companyId.toString() : null,
            companyName: company?.name ?? 'Employer',
            companySlug: company?.slug ?? null,
            logo: company?.logo ?? '',
            reason: row.reason ?? '',
            blockedAt: row.createdAt,
          };
        })
        .filter(Boolean),
    };
  }

  /** Used by apply/chat/invite flows. */
  async assertCandidateNotBlockingEmployerUser(
    candidateUserId: string,
    employerUserId: string,
  ): Promise<void> {
    const hit = await UserBlock.findOne({
      $or: [
        { blockerId: candidateUserId, blockedId: employerUserId },
        { blockerId: employerUserId, blockedId: candidateUserId },
      ],
    });
    if (hit) {
      throw new AppError(
        'You cannot interact with this employer because of a block',
        HTTP_STATUS.FORBIDDEN,
      );
    }
  }
}

export const candidateSafetyService = new CandidateSafetyService();
