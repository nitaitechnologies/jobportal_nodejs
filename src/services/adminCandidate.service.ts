import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { env } from '../config/env';
import { Candidate } from '../models/Candidate';
import { User } from '../models/User';
import type { AuthenticatedAdmin } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { mapAdminCandidateResponse } from '../utils/adminManagementMapper';
import { writeAuditSafely } from './audit.service';
import {
  notifySafely,
  resolveCandidateUserId,
} from './notification.service';
import type {
  AdminCandidateListQuery,
  AdminCandidateStatusInput,
  AdminCandidateVisibilityInput,
} from '../validators/adminManagement.validator';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class AdminCandidateService {
  async list(query: AdminCandidateListQuery) {
    const candidateFilter: Record<string, unknown> = {};
    if (query.profileVisibility) candidateFilter.profileVisibility = query.profileVisibility;
    if (query.profileCompletionMin !== undefined || query.profileCompletionMax !== undefined) {
      candidateFilter.profileCompletion = {};
      if (query.profileCompletionMin !== undefined) {
        (candidateFilter.profileCompletion as Record<string, number>).$gte =
          query.profileCompletionMin;
      }
      if (query.profileCompletionMax !== undefined) {
        (candidateFilter.profileCompletion as Record<string, number>).$lte =
          query.profileCompletionMax;
      }
    }
    if (query.experienceMin !== undefined || query.experienceMax !== undefined) {
      candidateFilter.totalExperience = {};
      if (query.experienceMin !== undefined) {
        (candidateFilter.totalExperience as Record<string, number>).$gte = query.experienceMin;
      }
      if (query.experienceMax !== undefined) {
        (candidateFilter.totalExperience as Record<string, number>).$lte = query.experienceMax;
      }
    }
    if (query.from || query.to) {
      candidateFilter.createdAt = {};
      if (query.from) {
        (candidateFilter.createdAt as Record<string, Date>).$gte = new Date(query.from);
      }
      if (query.to) {
        (candidateFilter.createdAt as Record<string, Date>).$lte = new Date(query.to);
      }
    }

    const candidates = await Candidate.find(candidateFilter).limit(5000);
    const users = await User.find({
      _id: { $in: candidates.map((c) => c.userId) },
      role: 'candidate',
      ...(query.status ? { status: query.status } : {}),
    }).select(
      'name email phone status emailVerified phoneVerified avatar lastLoginAt createdAt',
    );
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    let items = candidates
      .map((candidate) => {
        const user = userMap.get(candidate.userId.toString());
        if (!user) return null;
        if (query.search) {
          const q = query.search.toLowerCase();
          const hay = `${user.name} ${user.email} ${user.phone ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return null;
        }
        return mapAdminCandidateResponse({ candidate, user });
      })
      .filter(Boolean) as ReturnType<typeof mapAdminCandidateResponse>[];

    const sortKey = query.sortBy;
    const dir = query.sortOrder === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey] ?? '';
      const bv = (b as Record<string, unknown>)[sortKey] ?? '';
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });

    const total = items.length;
    const skip = (query.page - 1) * query.limit;
    items = items.slice(skip, skip + query.limit);

    return {
      candidates: items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    }
    const candidate = await Candidate.findById(id);
    if (!candidate) throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    const user = await User.findById(candidate.userId).select(
      'name email phone status emailVerified phoneVerified avatar lastLoginAt createdAt role',
    );
    if (!user || user.role !== 'candidate') {
      throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    }
    return {
      candidate: {
        ...mapAdminCandidateResponse({ candidate, user }),
        bio: candidate.bio ?? '',
        preferredLocations: candidate.preferredLocations ?? [],
        currentJobTitle: candidate.currentJobTitle ?? '',
        currentCompany: candidate.currentCompany ?? '',
        expectedSalary: candidate.expectedSalary ?? null,
        noticePeriod: candidate.noticePeriod ?? 0,
        educationCount: candidate.education?.length ?? 0,
        experienceCount: candidate.workExperience?.length ?? 0,
        hasResume: Boolean(candidate.resume?.trim()),
        hasVideoResume: env.enableVideoResume && Boolean(candidate.videoResume?.trim()),
      },
    };
  }

  async updateStatus(
    actor: AuthenticatedAdmin,
    id: string,
    input: AdminCandidateStatusInput,
  ) {
    const candidate = await Candidate.findById(id);
    if (!candidate) throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    const user = await User.findById(candidate.userId);
    if (!user || user.role !== 'candidate') {
      throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    }

    const previous = user.status;
    if (previous === 'deleted') {
      throw new AppError('Cannot modify a deleted candidate account', HTTP_STATUS.CONFLICT);
    }

    user.status = input.status;
    await user.save();

    await writeAuditSafely({
      admin: actor,
      action: `candidate_${input.status === 'active' ? 'activated' : input.status === 'suspended' ? 'suspended' : 'deactivated'}`,
      entityType: 'candidate',
      entityId: candidate._id,
      metadata: { from: previous, to: input.status, userId: user._id.toString() },
    });

    if (input.status === 'suspended' || input.status === 'inactive') {
      const userId = await resolveCandidateUserId(candidate._id);
      if (userId) {
        await notifySafely({
          recipientId: userId,
          type: 'SYSTEM',
          title: 'Account Status Updated',
          message:
            input.status === 'suspended'
              ? 'Your candidate account has been suspended by an administrator.'
              : 'Your candidate account has been deactivated by an administrator.',
          data: { status: input.status },
        });
      }
    }

    return this.getById(id);
  }

  async updateVisibility(
    actor: AuthenticatedAdmin,
    id: string,
    input: AdminCandidateVisibilityInput,
  ) {
    const candidate = await Candidate.findById(id);
    if (!candidate) throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);

    const previous = candidate.profileVisibility;
    candidate.profileVisibility = input.profileVisibility;
    await candidate.save();

    await writeAuditSafely({
      admin: actor,
      action: 'candidate_visibility_changed',
      entityType: 'candidate',
      entityId: candidate._id,
      metadata: { from: previous, to: input.profileVisibility },
    });

    return this.getById(id);
  }
}

export const adminCandidateService = new AdminCandidateService();
void escapeRegex;
