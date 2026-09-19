import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { Candidate } from '../models/Candidate';
import { Job } from '../models/Job';
import { User } from '../models/User';
import type { AuthenticatedEmployer } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { noticeDaysUntil } from '../utils/availability';
import { scoreJobMatch, type JobMatchSource, type MatchBreakdown } from '../utils/matchScore';

export type EmployerCandidateQuery = {
  q?: string;
  skill?: string;
  location?: string;
  experienceMin?: number;
  experienceMax?: number;
  availableBy?: string;
  jobId?: string;
  page: number;
  limit: number;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function jobSource(job: {
  title?: string;
  skills?: string[];
  requirements?: string[];
  experienceMin?: number;
  experienceMax?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  workMode?: string;
  location?: {
    address?: string;
    city?: string;
    displayName?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
}): JobMatchSource {
  const location = job.location;
  return {
    title: job.title ?? '',
    skills: job.skills ?? [],
    requirements: job.requirements ?? [],
    experienceMin: job.experienceMin ?? 0,
    experienceMax: job.experienceMax ?? null,
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    workMode: job.workMode,
    locationText: [location?.address, location?.city, location?.displayName].filter(Boolean).join(' '),
    latitude: typeof location?.latitude === 'number' ? location.latitude : null,
    longitude: typeof location?.longitude === 'number' ? location.longitude : null,
  };
}

function toCard(input: {
  candidate: {
    _id: { toString(): string };
    headline?: string;
    currentJobTitle?: string;
    currentLocation?: string;
    totalExperience?: number;
    skills?: string[];
    noticePeriod?: number;
    availableFrom?: Date | null;
    profileCompletion?: number;
    employmentStatus?: string;
    bio?: string;
    expectedSalary?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    education?: Array<{ degree?: string; institution?: string }>;
    workExperience?: Array<{ jobTitle?: string; company?: string }>;
  };
  user: { name: string };
  match: MatchBreakdown | null;
  detailed?: boolean;
}) {
  const { candidate, user, match } = input;
  return {
    id: candidate._id.toString(),
    name: user.name,
    headline: candidate.headline ?? '',
    currentJobTitle: candidate.currentJobTitle ?? '',
    currentLocation: candidate.currentLocation ?? '',
    totalExperience: candidate.totalExperience ?? 0,
    skills: (candidate.skills ?? []).slice(0, 12),
    noticePeriod: candidate.noticePeriod ?? 0,
    availableFrom: candidate.availableFrom ?? null,
    profileCompletion: candidate.profileCompletion ?? 0,
    employmentStatus: candidate.employmentStatus ?? 'looking',
    match,
    ...(input.detailed
      ? {
          bio: candidate.bio ?? '',
          expectedSalary: candidate.expectedSalary ?? null,
          education: (candidate.education ?? []).slice(0, 5).map((item) => ({
            degree: item.degree ?? '',
            institution: item.institution ?? '',
          })),
          workExperience: (candidate.workExperience ?? []).slice(0, 5).map((item) => ({
            jobTitle: item.jobTitle ?? '',
            company: item.company ?? '',
          })),
        }
      : {}),
  };
}

export class EmployerCandidateService {
  private async ownedJob(employer: AuthenticatedEmployer, jobId: string) {
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
    }
    const job = await Job.findOne({
      _id: jobId,
      employerId: employer.employerId,
      companyId: employer.companyId,
      deletedAt: null,
    }).select(
      'title skills requirements experienceMin experienceMax salaryMin salaryMax workMode location',
    );
    if (!job) throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
    return job;
  }

  async list(employer: AuthenticatedEmployer, query: EmployerCandidateQuery) {
    const filter: Record<string, unknown> = {
      profileVisibility: { $in: ['public', 'employers_only'] },
    };
    if (query.skill?.trim()) {
      filter.skills = new RegExp(`^${escapeRegex(query.skill.trim())}$`, 'i');
    }
    if (query.location?.trim()) {
      filter.currentLocation = new RegExp(escapeRegex(query.location.trim()), 'i');
    }
    if (query.experienceMin !== undefined || query.experienceMax !== undefined) {
      const range: Record<string, number> = {};
      if (query.experienceMin !== undefined) range.$gte = query.experienceMin;
      if (query.experienceMax !== undefined) range.$lte = query.experienceMax;
      filter.totalExperience = range;
    }
    if (query.availableBy) {
      const by = new Date(query.availableBy);
      const days = noticeDaysUntil(by);
      filter.$or = [
        { availableFrom: { $lte: by } },
        { availableFrom: null, noticePeriod: { $lte: days } },
        { availableFrom: { $exists: false }, noticePeriod: { $lte: days } },
      ];
    }

    const job = query.jobId ? await this.ownedJob(employer, query.jobId) : null;
    const candidates = await Candidate.find(filter).sort({ updatedAt: -1 }).limit(300);
    const users = await User.find({
      _id: { $in: candidates.map((item) => item.userId) },
      role: 'candidate',
      status: 'active',
    }).select('name');
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));
    const needle = query.q?.trim().toLowerCase() ?? '';

    let rows = candidates.flatMap((candidate) => {
      const user = userMap.get(candidate.userId.toString());
      if (!user) return [];
      if (needle) {
        const hay = `${user.name} ${candidate.headline ?? ''} ${candidate.currentJobTitle ?? ''} ${(candidate.skills ?? []).join(' ')}`.toLowerCase();
        if (!hay.includes(needle)) return [];
      }
      const match = job
        ? scoreJobMatch(jobSource(job), {
            headline: candidate.headline,
            currentJobTitle: candidate.currentJobTitle,
            skills: candidate.skills,
            totalExperience: candidate.totalExperience,
            expectedSalary: candidate.expectedSalary,
            currentLocation: candidate.currentLocation,
            latitude: candidate.latitude,
            longitude: candidate.longitude,
          })
        : null;
      return [toCard({ candidate, user, match })];
    });

    if (job) {
      rows = rows.sort((a, b) => (b.match?.overall ?? 0) - (a.match?.overall ?? 0));
    }

    const total = rows.length;
    const start = (query.page - 1) * query.limit;
    return {
      candidates: rows.slice(start, start + query.limit),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
      job: job ? { id: job._id.toString(), title: job.title } : null,
    };
  }

  async getById(employer: AuthenticatedEmployer, id: string, jobId?: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    }
    const candidate = await Candidate.findOne({
      _id: id,
      profileVisibility: { $in: ['public', 'employers_only'] },
    });
    if (!candidate) throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    const user = await User.findOne({
      _id: candidate.userId,
      role: 'candidate',
      status: 'active',
    }).select('name');
    if (!user) throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    const job = jobId ? await this.ownedJob(employer, jobId) : null;
    const match = job
      ? scoreJobMatch(jobSource(job), {
          headline: candidate.headline,
          currentJobTitle: candidate.currentJobTitle,
          skills: candidate.skills,
          totalExperience: candidate.totalExperience,
          expectedSalary: candidate.expectedSalary,
          currentLocation: candidate.currentLocation,
          latitude: candidate.latitude,
          longitude: candidate.longitude,
        })
      : null;
    return {
      candidate: toCard({ candidate, user, match, detailed: true }),
      job: job ? { id: job._id.toString(), title: job.title } : null,
    };
  }
}

export const employerCandidateService = new EmployerCandidateService();
