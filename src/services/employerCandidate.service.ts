import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { Candidate } from '../models/Candidate';
import { ContactUnlock } from '../models/ContactUnlock';
import { EmployerCandidateSavedSearch } from '../models/EmployerCandidateSavedSearch';
import { Job } from '../models/Job';
import { Notification } from '../models/Notification';
import { RecontactReminder } from '../models/RecontactReminder';
import { SavedCandidate } from '../models/SavedCandidate';
import { TalentPoolFolder } from '../models/TalentPoolFolder';
import { User } from '../models/User';
import { MediaFile } from '../models/MediaFile';
import type { AuthenticatedEmployer } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { noticeDaysUntil } from '../utils/availability';
import { haversineKm } from '../utils/geo';
import { parseMediaRef } from '../utils/mediaMapper';
import { scoreJobMatch, type JobMatchSource, type MatchBreakdown } from '../utils/matchScore';
import {
  canUnlockCandidateContact,
  getEmployerEntitlements,
  hasAdvancedCandidateSearch,
} from './entitlement.service';
import { notifySafely, resolveCandidateUserId } from './notification.service';
import { trackSafely } from './analytics.service';
import { companyUsesPackageWallets } from './cityPackage.service';
import { walletService } from './wallet.service';
import { resolveCreditCosts } from './creditCatalog.service';
import type {
  EmployerCandidateFolderCreateInput,
  EmployerCandidateFolderUpdateInput,
  EmployerCandidateRecontactCreateInput,
  EmployerCandidateRecontactQuery,
  EmployerCandidateSaveBody,
  EmployerCandidateSavedListQuery,
  EmployerCandidateSavedSearchCreateInput,
  EmployerCandidateSearchFiltersInput,
  EmployerCandidateTagsBody,
  EmployerCandidateUpdateSavedBody,
} from '../validators/employerCandidate.validator';

export type EmployerCandidateQuery = {
  q?: string;
  skill?: string;
  skills?: string[];
  location?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  experienceMin?: number;
  experienceMax?: number;
  education?: string;
  expectedSalaryMin?: number;
  expectedSalaryMax?: number;
  jobType?: string;
  workMode?: string;
  availableBy?: string;
  noticePeriodMax?: number;
  language?: string;
  isFresher?: boolean;
  openToWork?: boolean;
  jobId?: string;
  page: number;
  limit: number;
};

export type EmployerCandidateSearchFilters = EmployerCandidateSearchFiltersInput;

type SavedMeta = {
  tags: string[];
  folderId: string | null;
  notes: string;
};

type CandidateCardSource = {
  _id: { toString(): string };
  userId: { toString(): string };
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
  education?: Array<{ degree?: string; fieldOfStudy?: string; institution?: string }>;
  workExperience?: Array<{ jobTitle?: string; company?: string }>;
  languages?: Array<{ name?: string; proficiency?: string }>;
  openToWork?: boolean;
  preferredJobTypes?: string[];
  preferredWorkModes?: string[];
  certifications?: Array<{ name?: string; issuer?: string }>;
  resume?: string;
  videoResume?: string;
  verificationStatus?: string;
};

const LIST_FETCH_CAP = 500;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function companyId(employer: AuthenticatedEmployer) {
  return new mongoose.Types.ObjectId(employer.companyId);
}

function hasStoredResume(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasStoredVideoResume(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
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

function candidateMatchSource(candidate: CandidateCardSource): Parameters<typeof scoreJobMatch>[1] {
  return {
    headline: candidate.headline,
    currentJobTitle: candidate.currentJobTitle,
    skills: candidate.skills,
    totalExperience: candidate.totalExperience,
    expectedSalary: candidate.expectedSalary,
    currentLocation: candidate.currentLocation,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    openToWork: candidate.openToWork,
    availableFrom: candidate.availableFrom,
    noticePeriod: candidate.noticePeriod,
  };
}

function buildListFilter(query: EmployerCandidateQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    profileVisibility: { $in: ['public', 'employers_only'] },
  };

  const skillList = [
    ...(query.skills ?? []),
    ...(query.skill?.trim() ? [query.skill.trim()] : []),
  ].map((item) => item.trim()).filter(Boolean);

  if (skillList.length === 1) {
    filter.skills = new RegExp(`^${escapeRegex(skillList[0])}$`, 'i');
  } else if (skillList.length > 1) {
    filter.$and = skillList.map((skill) => ({
      skills: new RegExp(`^${escapeRegex(skill)}$`, 'i'),
    }));
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

  if (query.isFresher === true) {
    filter.totalExperience = { $lte: 0 };
  }

  if (query.education?.trim()) {
    const pattern = new RegExp(escapeRegex(query.education.trim()), 'i');
    filter.$or = [
      { 'education.degree': pattern },
      { 'education.fieldOfStudy': pattern },
      { 'education.institution': pattern },
    ];
  }

  if (query.expectedSalaryMin !== undefined || query.expectedSalaryMax !== undefined) {
    const range: Record<string, number> = {};
    if (query.expectedSalaryMin !== undefined) range.$gte = query.expectedSalaryMin;
    if (query.expectedSalaryMax !== undefined) range.$lte = query.expectedSalaryMax;
    filter.expectedSalary = range;
  }

  if (query.jobType) {
    filter.preferredJobTypes = query.jobType;
  }

  if (query.workMode) {
    filter.preferredWorkModes = query.workMode;
  }

  if (query.availableBy) {
    const by = new Date(query.availableBy);
    const days = noticeDaysUntil(by);
    const availabilityClause = [
      { availableFrom: { $lte: by } },
      { availableFrom: null, noticePeriod: { $lte: days } },
      { availableFrom: { $exists: false }, noticePeriod: { $lte: days } },
    ];
    if (filter.$or) {
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        { $or: filter.$or },
        { $or: availabilityClause },
      ];
      delete filter.$or;
    } else {
      filter.$or = availabilityClause;
    }
  }

  if (query.noticePeriodMax !== undefined) {
    filter.noticePeriod = { $lte: query.noticePeriodMax };
  }

  if (query.language?.trim()) {
    filter['languages.name'] = new RegExp(escapeRegex(query.language.trim()), 'i');
  }

  if (query.openToWork !== undefined) {
    filter.openToWork = query.openToWork;
  }

  return filter;
}

function toCard(input: {
  candidate: CandidateCardSource;
  user: { name: string; phone?: string; email?: string };
  match: MatchBreakdown | null;
  detailed?: boolean;
  saved?: SavedMeta | null;
  contactUnlocked?: boolean;
  distanceKm?: number;
}) {
  const { candidate, user, match, saved, contactUnlocked = false } = input;
  const languageNames = (candidate.languages ?? [])
    .map((item) => item.name?.trim())
    .filter((name): name is string => Boolean(name));
  const resumeValue = candidate.resume ?? '';
  const videoResumeValue = candidate.videoResume ?? '';

  const base = {
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
    openToWork: candidate.openToWork !== false,
    languages: languageNames,
    hasResume: hasStoredResume(resumeValue),
    hasVideoResume: hasStoredVideoResume(videoResumeValue),
    isSaved: Boolean(saved),
    tags: saved?.tags ?? [],
    contactUnlocked,
    match,
    ...(input.distanceKm !== undefined ? { distanceKm: input.distanceKm } : {}),
  };

  if (!input.detailed) {
    return base;
  }

  const contact =
    contactUnlocked && (user.phone || user.email)
      ? { phone: user.phone ?? '', email: user.email ?? '' }
      : null;

  return {
    ...base,
    bio: candidate.bio ?? '',
    expectedSalary: candidate.expectedSalary ?? null,
    preferredJobTypes: candidate.preferredJobTypes ?? [],
    preferredWorkModes: candidate.preferredWorkModes ?? [],
    verificationStatus: candidate.verificationStatus ?? 'unverified',
    folderId: saved?.folderId ?? null,
    contact,
    education: (candidate.education ?? []).slice(0, 5).map((item) => ({
      degree: item.degree ?? '',
      fieldOfStudy: item.fieldOfStudy ?? '',
      institution: item.institution ?? '',
    })),
    workExperience: (candidate.workExperience ?? []).slice(0, 5).map((item) => ({
      jobTitle: item.jobTitle ?? '',
      company: item.company ?? '',
    })),
    certifications: (candidate.certifications ?? []).slice(0, 5).map((item) => ({
      name: item.name ?? '',
      issuer: item.issuer ?? '',
    })),
    notes: saved?.notes ?? '',
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

  private async ownedFolder(employer: AuthenticatedEmployer, folderId: string) {
    if (!mongoose.Types.ObjectId.isValid(folderId)) {
      throw new AppError('Folder not found', HTTP_STATUS.NOT_FOUND);
    }
    const folder = await TalentPoolFolder.findOne({
      _id: folderId,
      companyId: companyId(employer),
    });
    if (!folder) throw new AppError('Folder not found', HTTP_STATUS.NOT_FOUND);
    return folder;
  }

  private async loadSavedMap(employer: AuthenticatedEmployer, candidateIds: string[]) {
    if (candidateIds.length === 0) return new Map<string, SavedMeta>();
    const rows = await SavedCandidate.find({
      companyId: companyId(employer),
      candidateId: { $in: candidateIds.map((id) => new mongoose.Types.ObjectId(id)) },
    }).select('candidateId folderId tags notes');
    return new Map(
      rows.map((row) => [
        row.candidateId.toString(),
        {
          tags: row.tags ?? [],
          folderId: row.folderId ? row.folderId.toString() : null,
          notes: row.notes ?? '',
        },
      ]),
    );
  }

  private async loadUnlockedSet(employer: AuthenticatedEmployer, candidateIds: string[]) {
    if (candidateIds.length === 0) return new Set<string>();
    const rows = await ContactUnlock.find({
      companyId: companyId(employer),
      candidateId: { $in: candidateIds.map((id) => new mongoose.Types.ObjectId(id)) },
    }).select('candidateId');
    return new Set(rows.map((row) => row.candidateId.toString()));
  }

  async assertVisibleCandidate(_employer: AuthenticatedEmployer, id: string) {
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
    }).select('_id');
    if (!user) throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    return candidate;
  }

  async list(employer: AuthenticatedEmployer, query: EmployerCandidateQuery) {
    const entitlements = await getEmployerEntitlements(employer);
    const advanced = hasAdvancedCandidateSearch(entitlements);
    const advancedKeys = [
      'education',
      'expectedSalaryMin',
      'expectedSalaryMax',
      'jobType',
      'workMode',
      'availableBy',
      'noticePeriodMax',
      'language',
      'lat',
      'lng',
      'radiusKm',
      'jobId',
      'isFresher',
    ] as const;
    if (!advanced) {
      const used = advancedKeys.filter((key) => {
        const value = query[key as keyof EmployerCandidateQuery];
        return value !== undefined && value !== null && value !== '';
      });
      if (used.length > 0) {
        throw new AppError(
          'Advanced candidate search requires a paid plan',
          HTTP_STATUS.FORBIDDEN,
          used.map((path) => ({
            path,
            message: 'Upgrade for advanced candidate database filters',
          })),
        );
      }
    }

    const filter = buildListFilter(query);
    const job = query.jobId ? await this.ownedJob(employer, query.jobId) : null;
    const fetchCap = advanced
      ? LIST_FETCH_CAP
      : Math.min(
          LIST_FETCH_CAP,
          Math.max(1, entitlements.limits.freeSearchResultLimit || 25),
        );
    const candidates = await Candidate.find(filter).sort({ updatedAt: -1 }).limit(fetchCap);

    const candidateIds = candidates.map((item) => item._id.toString());
    const [users, savedMap, unlockedSet] = await Promise.all([
      User.find({
        _id: { $in: candidates.map((item) => item.userId) },
        role: 'candidate',
        status: 'active',
      }).select('name phone email'),
      this.loadSavedMap(employer, candidateIds),
      this.loadUnlockedSet(employer, candidateIds),
    ]);
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));
    const needle = query.q?.trim().toLowerCase() ?? '';

    const geoActive =
      query.lat !== undefined && query.lng !== undefined && query.radiusKm !== undefined;

    let rows = candidates.flatMap((candidate) => {
      const user = userMap.get(candidate.userId.toString());
      if (!user) return [];

      if (needle) {
        const hay = `${user.name} ${candidate.headline ?? ''} ${candidate.currentJobTitle ?? ''} ${(candidate.skills ?? []).join(' ')}`.toLowerCase();
        if (!hay.includes(needle)) return [];
      }

      let distanceKm: number | undefined;
      if (geoActive) {
        const lat = candidate.latitude;
        const lng = candidate.longitude;
        if (typeof lat !== 'number' || typeof lng !== 'number') return [];
        distanceKm = haversineKm(
          { latitude: query.lat!, longitude: query.lng! },
          { latitude: lat, longitude: lng },
        );
        if (distanceKm > query.radiusKm!) return [];
      }

      const candidateId = candidate._id.toString();
      const saved = savedMap.get(candidateId) ?? null;
      const match = job
        ? scoreJobMatch(jobSource(job), candidateMatchSource(candidate))
        : null;

      return [
        toCard({
          candidate,
          user,
          match,
          saved,
          contactUnlocked: unlockedSet.has(candidateId),
          distanceKm,
        }),
      ];
    });

    if (job) {
      rows = rows.sort((a, b) => (b.match?.overall ?? 0) - (a.match?.overall ?? 0));
    } else if (geoActive) {
      rows = rows.sort(
        (a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER),
      );
    }

    const total = rows.length;
    const pageLimit = advanced
      ? query.limit
      : Math.min(query.limit, Math.max(1, entitlements.limits.freeSearchResultLimit || 25));
    const start = (query.page - 1) * pageLimit;
    return {
      candidates: rows.slice(start, start + pageLimit),
      pagination: {
        page: query.page,
        limit: pageLimit,
        total: advanced ? total : Math.min(total, fetchCap),
        totalPages: Math.max(
          1,
          Math.ceil((advanced ? total : Math.min(total, fetchCap)) / pageLimit),
        ),
      },
      searchTier: advanced ? 'advanced' : 'basic',
      freeSearchResultLimit: advanced ? null : entitlements.limits.freeSearchResultLimit || 25,
      job: job ? { id: job._id.toString(), title: job.title } : null,
    };
  }

  async getById(employer: AuthenticatedEmployer, id: string, jobId?: string) {
    const candidate = await this.assertVisibleCandidate(employer, id);
    const user = await User.findOne({
      _id: candidate.userId,
      role: 'candidate',
      status: 'active',
    }).select('name phone email');
    if (!user) throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);

    const [job, savedMap, unlockedSet, contact] = await Promise.all([
      jobId ? this.ownedJob(employer, jobId) : Promise.resolve(null),
      this.loadSavedMap(employer, [id]),
      this.loadUnlockedSet(employer, [id]),
      this.getContactIfUnlocked(employer, id),
    ]);

    const match = job
      ? scoreJobMatch(jobSource(job), candidateMatchSource(candidate))
      : null;

    await trackSafely({
      eventType: 'profile_view',
      userId: employer.userId,
      actorRole: 'employer',
      entityType: 'candidate',
      entityId: candidate._id,
      candidateId: candidate._id,
      employerId: employer.employerId,
      companyId: employer.companyId,
      jobId: job?._id,
    });

    await this.notifyProfileViewedOnce(employer, candidate._id.toString(), job);

    const saved = savedMap.get(id) ?? null;
    const card = toCard({
      candidate,
      user: {
        name: user.name,
        phone: contact?.phone,
        email: contact?.email,
      },
      match,
      detailed: true,
      saved,
      contactUnlocked: unlockedSet.has(id),
    });

    return {
      candidate: card,
      job: job ? { id: job._id.toString(), title: job.title } : null,
    };
  }

  async getResumeMeta(employer: AuthenticatedEmployer, candidateId: string) {
    const candidate = await this.assertVisibleCandidate(employer, candidateId);
    if (candidate.resumeVisibleToEmployers === false) {
      throw new AppError(
        'This candidate has hidden their resume from employers',
        HTTP_STATUS.FORBIDDEN,
        [{ path: 'resumeVisibleToEmployers', message: 'Resume is private' }],
      );
    }
    const resume = candidate.resume ?? '';
    const hasResume = hasStoredResume(resume);
    if (!hasResume) {
      return { hasResume: false as const };
    }

    const mediaId = parseMediaRef(resume);
    if (mediaId) {
      const media = await MediaFile.findById(mediaId).select('originalName status');
      if (media && media.status === 'active') {
        return { hasResume: true as const, fileName: media.originalName };
      }
    }

    if (/^https?:\/\//i.test(resume)) {
      return { hasResume: true as const, fileName: 'resume' };
    }

    return { hasResume: true as const };
  }

  async getContactIfUnlocked(employer: AuthenticatedEmployer, candidateId: string) {
    const unlock = await ContactUnlock.findOne({
      companyId: companyId(employer),
      candidateId: new mongoose.Types.ObjectId(candidateId),
    });
    if (!unlock) return null;

    const candidate = await Candidate.findById(candidateId).select('userId');
    if (!candidate) return null;

    const user = await User.findOne({
      _id: candidate.userId,
      role: 'candidate',
      status: 'active',
    }).select('phone email');
    if (!user) return null;

    return { phone: user.phone ?? '', email: user.email ?? '' };
  }

  async unlockContact(employer: AuthenticatedEmployer, candidateId: string) {
    await this.assertVisibleCandidate(employer, candidateId);

    const existing = await this.getContactIfUnlocked(employer, candidateId);
    const entitlements = await getEmployerEntitlements(employer);

    if (existing) {
      const remaining = Math.max(
        0,
        entitlements.limits.contactUnlockLimit - entitlements.usage.contactUnlocksUsed,
      );
      return {
        contact: existing,
        creditsSpent: 0,
        remaining,
        alreadyUnlocked: true,
        paidWithWallet: false,
      };
    }

    const candidateDoc = await Candidate.findById(candidateId).select(
      'userId allowEmployerContact',
    );
    if (!candidateDoc) throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    if (candidateDoc.allowEmployerContact === false) {
      throw new AppError(
        'This candidate has not consented to employer contact',
        HTTP_STATUS.FORBIDDEN,
        [{ path: 'allowEmployerContact', message: 'Candidate privacy preference blocks unlock' }],
      );
    }

    const planAllows = canUnlockCandidateContact(entitlements);
    const underPlanLimit =
      entitlements.usage.contactUnlocksUsed < entitlements.limits.contactUnlockLimit;
    let creditsSpent = 0;
    let paidWithWallet = false;
    const packageWallets = await companyUsesPackageWallets(employer.companyId);

    if (packageWallets) {
      await walletService.debitBucket({
        companyId: employer.companyId,
        bucket: 'unlocks',
        credits: 1,
        type: 'spend_unlock',
        description: `Database unlock for candidate ${candidateId}`,
        metadata: { candidateId },
      });
      creditsSpent = 1;
      paidWithWallet = true;
    } else if (planAllows && underPlanLimit) {
      creditsSpent = 0;
    } else {
      const costs = await resolveCreditCosts();
      await walletService.debit({
        companyId: employer.companyId,
        credits: costs.contactUnlock,
        type: 'spend_unlock',
        description: `Contact unlock for candidate ${candidateId}`,
        metadata: { candidateId },
      });
      creditsSpent = costs.contactUnlock;
      paidWithWallet = true;
    }

    const user = await User.findOne({
      _id: candidateDoc.userId,
      role: 'candidate',
      status: 'active',
    }).select('phone email');
    if (!user) throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);

    await ContactUnlock.create({
      companyId: companyId(employer),
      employerId: new mongoose.Types.ObjectId(employer.employerId),
      candidateId: new mongoose.Types.ObjectId(candidateId),
      creditsSpent,
    });

    await trackSafely({
      eventType: 'profile_view',
      userId: employer.userId,
      actorRole: 'employer',
      entityType: 'candidate',
      entityId: candidateId,
      candidateId,
      employerId: employer.employerId,
      companyId: employer.companyId,
      metadata: { action: 'contact_unlock', paidWithWallet },
    });

    const remaining = packageWallets
      ? await walletService.bucketBalance(employer.companyId, 'unlocks')
      : paidWithWallet
        ? Math.max(
            0,
            entitlements.limits.contactUnlockLimit - entitlements.usage.contactUnlocksUsed,
          )
        : Math.max(
            0,
            entitlements.limits.contactUnlockLimit - entitlements.usage.contactUnlocksUsed - 1,
          );

    return {
      contact: { phone: user.phone ?? '', email: user.email ?? '' },
      creditsSpent,
      remaining,
      alreadyUnlocked: false,
      paidWithWallet,
    };
  }

  async listUnlockHistory(
    employer: AuthenticatedEmployer,
    query: { page: number; limit: number },
  ) {
    const filter = { companyId: companyId(employer) };
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      ContactUnlock.countDocuments(filter),
      ContactUnlock.find(filter).sort({ unlockedAt: -1 }).skip(skip).limit(query.limit),
    ]);

    const candidateIds = rows.map((row) => row.candidateId);
    const candidates = await Candidate.find({ _id: { $in: candidateIds } }).select(
      'userId headline currentJobTitle currentLocation',
    );
    const users = await User.find({
      _id: { $in: candidates.map((c) => c.userId) },
      role: 'candidate',
    }).select('name');
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const candMap = new Map(candidates.map((c) => [c._id.toString(), c]));

    return {
      unlocks: rows.map((row) => {
        const cand = candMap.get(row.candidateId.toString());
        const user = cand ? userMap.get(cand.userId.toString()) : null;
        return {
          id: row._id.toString(),
          candidateId: row.candidateId.toString(),
          candidateName: user?.name ?? 'Candidate',
          headline: cand?.headline ?? '',
          currentJobTitle: cand?.currentJobTitle ?? '',
          currentLocation: cand?.currentLocation ?? '',
          creditsSpent: row.creditsSpent ?? 0,
          unlockedAt: row.unlockedAt ?? row.createdAt ?? null,
        };
      }),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async listSavedSearches(employer: AuthenticatedEmployer) {
    const rows = await EmployerCandidateSavedSearch.find({
      companyId: companyId(employer),
      employerId: new mongoose.Types.ObjectId(employer.employerId),
    }).sort({ createdAt: -1 });

    return {
      savedSearches: rows.map((row) => ({
        id: row._id.toString(),
        name: row.name,
        filters: row.filters ?? {},
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    };
  }

  async createSavedSearch(
    employer: AuthenticatedEmployer,
    input: EmployerCandidateSavedSearchCreateInput,
  ) {
    const entitlements = await getEmployerEntitlements(employer);
    if (!hasAdvancedCandidateSearch(entitlements)) {
      throw new AppError(
        'Saved searches require a paid candidate database plan',
        HTTP_STATUS.FORBIDDEN,
        [{ path: 'savedSearch', message: 'Upgrade to unlock advanced search' }],
      );
    }
    const row = await EmployerCandidateSavedSearch.create({
      companyId: companyId(employer),
      employerId: new mongoose.Types.ObjectId(employer.employerId),
      name: input.name,
      filters: input.filters ?? {},
    });

    return {
      savedSearch: {
        id: row._id.toString(),
        name: row.name,
        filters: row.filters ?? {},
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    };
  }

  async deleteSavedSearch(employer: AuthenticatedEmployer, id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Saved search not found', HTTP_STATUS.NOT_FOUND);
    }
    const result = await EmployerCandidateSavedSearch.deleteOne({
      _id: id,
      companyId: companyId(employer),
      employerId: new mongoose.Types.ObjectId(employer.employerId),
    });
    if (result.deletedCount === 0) {
      throw new AppError('Saved search not found', HTTP_STATUS.NOT_FOUND);
    }
    return { deleted: true };
  }

  async listFolders(employer: AuthenticatedEmployer) {
    const folders = await TalentPoolFolder.find({
      companyId: companyId(employer),
    }).sort({ createdAt: -1 });

    const counts = await SavedCandidate.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { companyId: companyId(employer), folderId: { $ne: null } } },
      { $group: { _id: '$folderId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((row) => [row._id.toString(), row.count]));

    return {
      folders: folders.map((folder) => ({
        id: folder._id.toString(),
        name: folder.name,
        description: folder.description ?? '',
        memberCount: countMap.get(folder._id.toString()) ?? 0,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      })),
    };
  }

  async createFolder(employer: AuthenticatedEmployer, input: EmployerCandidateFolderCreateInput) {
    try {
      const folder = await TalentPoolFolder.create({
        companyId: companyId(employer),
        employerId: new mongoose.Types.ObjectId(employer.employerId),
        name: input.name,
        description: input.description ?? '',
      });
      return {
        folder: {
          id: folder._id.toString(),
          name: folder.name,
          description: folder.description ?? '',
          memberCount: 0,
          createdAt: folder.createdAt,
          updatedAt: folder.updatedAt,
        },
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as { code?: number }).code === 11000) {
        throw new AppError('A folder with this name already exists', HTTP_STATUS.CONFLICT);
      }
      throw error;
    }
  }

  async updateFolder(
    employer: AuthenticatedEmployer,
    id: string,
    input: EmployerCandidateFolderUpdateInput,
  ) {
    const folder = await this.ownedFolder(employer, id);
    if (input.name !== undefined) folder.name = input.name;
    if (input.description !== undefined) folder.description = input.description;
    try {
      await folder.save();
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as { code?: number }).code === 11000) {
        throw new AppError('A folder with this name already exists', HTTP_STATUS.CONFLICT);
      }
      throw error;
    }

    const memberCount = await SavedCandidate.countDocuments({
      companyId: companyId(employer),
      folderId: folder._id,
    });

    return {
      folder: {
        id: folder._id.toString(),
        name: folder.name,
        description: folder.description ?? '',
        memberCount,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      },
    };
  }

  async deleteFolder(employer: AuthenticatedEmployer, id: string) {
    await this.ownedFolder(employer, id);
    await SavedCandidate.updateMany(
      { companyId: companyId(employer), folderId: new mongoose.Types.ObjectId(id) },
      { $unset: { folderId: 1 } },
    );
    const result = await TalentPoolFolder.deleteOne({
      _id: id,
      companyId: companyId(employer),
    });
    if (result.deletedCount === 0) {
      throw new AppError('Folder not found', HTTP_STATUS.NOT_FOUND);
    }
    return { deleted: true };
  }

  async listSaved(employer: AuthenticatedEmployer, query: EmployerCandidateSavedListQuery) {
    const filter: Record<string, unknown> = {
      companyId: companyId(employer),
    };
    if (query.folderId) {
      filter.folderId = new mongoose.Types.ObjectId(query.folderId);
    }
    if (query.tag) {
      filter.tags = query.tag;
    }

    const total = await SavedCandidate.countDocuments(filter);
    const savedRows = await SavedCandidate.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit);

    const candidateIds = savedRows.map((row) => row.candidateId.toString());
    const candidates = await Candidate.find({
      _id: { $in: savedRows.map((row) => row.candidateId) },
      profileVisibility: { $in: ['public', 'employers_only'] },
    });
    const [users, unlockedSet] = await Promise.all([
      User.find({
        _id: { $in: candidates.map((item) => item.userId) },
        role: 'candidate',
        status: 'active',
      }).select('name'),
      this.loadUnlockedSet(employer, candidateIds),
    ]);

    const candidateMap = new Map(candidates.map((item) => [item._id.toString(), item]));
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));

    const rows = savedRows.flatMap((saved) => {
      const candidate = candidateMap.get(saved.candidateId.toString());
      if (!candidate) return [];
      const user = userMap.get(candidate.userId.toString());
      if (!user) return [];
      const candidateId = candidate._id.toString();
      return [
        {
          savedAt: saved.createdAt,
          ...toCard({
            candidate,
            user,
            match: null,
            saved: {
              tags: saved.tags ?? [],
              folderId: saved.folderId ? saved.folderId.toString() : null,
              notes: saved.notes ?? '',
            },
            contactUnlocked: unlockedSet.has(candidateId),
          }),
        },
      ];
    });

    return {
      candidates: rows,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async saveCandidate(
    employer: AuthenticatedEmployer,
    candidateId: string,
    input: EmployerCandidateSaveBody,
  ) {
    await this.assertVisibleCandidate(employer, candidateId);
    if (input.folderId) {
      await this.ownedFolder(employer, input.folderId);
    }

    const setPayload: Record<string, unknown> = {
      employerId: new mongoose.Types.ObjectId(employer.employerId),
      tags: input.tags ?? [],
      notes: input.notes ?? '',
    };
    if (input.folderId) {
      setPayload.folderId = new mongoose.Types.ObjectId(input.folderId);
    }

    const row = await SavedCandidate.findOneAndUpdate(
      {
        companyId: companyId(employer),
        candidateId: new mongoose.Types.ObjectId(candidateId),
      },
      {
        $set: setPayload,
        $setOnInsert: {
          companyId: companyId(employer),
          candidateId: new mongoose.Types.ObjectId(candidateId),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await trackSafely({
      eventType: 'profile_view',
      userId: employer.userId,
      actorRole: 'employer',
      entityType: 'candidate',
      entityId: candidateId,
      candidateId,
      employerId: employer.employerId,
      companyId: employer.companyId,
      metadata: { action: 'candidate_saved' },
    });

    return {
      saved: {
        candidateId,
        folderId: row.folderId ? row.folderId.toString() : null,
        tags: row.tags ?? [],
        notes: row.notes ?? '',
      },
    };
  }

  async updateSaved(
    employer: AuthenticatedEmployer,
    candidateId: string,
    input: EmployerCandidateUpdateSavedBody,
  ) {
    if (!mongoose.Types.ObjectId.isValid(candidateId)) {
      throw new AppError('Saved candidate not found', HTTP_STATUS.NOT_FOUND);
    }
    if (input.folderId) {
      await this.ownedFolder(employer, input.folderId);
    }

    const update: Record<string, unknown> = {};
    if (input.folderId !== undefined) {
      update.folderId = input.folderId
        ? new mongoose.Types.ObjectId(input.folderId)
        : null;
    }
    if (input.tags !== undefined) update.tags = input.tags;
    if (input.notes !== undefined) update.notes = input.notes;

    const row = await SavedCandidate.findOneAndUpdate(
      {
        companyId: companyId(employer),
        candidateId: new mongoose.Types.ObjectId(candidateId),
      },
      { $set: update },
      { new: true },
    );
    if (!row) throw new AppError('Saved candidate not found', HTTP_STATUS.NOT_FOUND);

    return {
      saved: {
        candidateId,
        folderId: row.folderId ? row.folderId.toString() : null,
        tags: row.tags ?? [],
        notes: row.notes ?? '',
      },
    };
  }

  async unsaveCandidate(employer: AuthenticatedEmployer, candidateId: string) {
    if (!mongoose.Types.ObjectId.isValid(candidateId)) {
      throw new AppError('Saved candidate not found', HTTP_STATUS.NOT_FOUND);
    }
    const result = await SavedCandidate.deleteOne({
      companyId: companyId(employer),
      candidateId: new mongoose.Types.ObjectId(candidateId),
    });
    if (result.deletedCount === 0) {
      throw new AppError('Saved candidate not found', HTTP_STATUS.NOT_FOUND);
    }
    return { deleted: true };
  }

  async setTags(
    employer: AuthenticatedEmployer,
    candidateId: string,
    input: EmployerCandidateTagsBody,
  ) {
    if (!mongoose.Types.ObjectId.isValid(candidateId)) {
      throw new AppError('Saved candidate not found', HTTP_STATUS.NOT_FOUND);
    }
    const row = await SavedCandidate.findOneAndUpdate(
      {
        companyId: companyId(employer),
        candidateId: new mongoose.Types.ObjectId(candidateId),
      },
      { $set: { tags: input.tags } },
      { new: true },
    );
    if (!row) throw new AppError('Saved candidate not found', HTTP_STATUS.NOT_FOUND);
    return {
      saved: {
        candidateId,
        tags: row.tags ?? [],
      },
    };
  }

  async scheduleRecontact(
    employer: AuthenticatedEmployer,
    input: EmployerCandidateRecontactCreateInput,
  ) {
    await this.assertVisibleCandidate(employer, input.candidateId);
    if (input.jobId) {
      await this.ownedJob(employer, input.jobId);
    }

    const reminder = await RecontactReminder.create({
      companyId: companyId(employer),
      employerId: new mongoose.Types.ObjectId(employer.employerId),
      candidateId: new mongoose.Types.ObjectId(input.candidateId),
      note: input.note ?? '',
      remindAt: input.remindAt,
      jobId: input.jobId ? new mongoose.Types.ObjectId(input.jobId) : undefined,
      status: 'scheduled',
    });

    return {
      recontact: {
        id: reminder._id.toString(),
        candidateId: input.candidateId,
        note: reminder.note ?? '',
        remindAt: reminder.remindAt,
        jobId: reminder.jobId ? reminder.jobId.toString() : null,
        status: reminder.status,
        createdAt: reminder.createdAt,
      },
    };
  }

  async listRecontacts(employer: AuthenticatedEmployer, query: EmployerCandidateRecontactQuery) {
    const filter: Record<string, unknown> = {
      companyId: companyId(employer),
    };
    if (query.status) filter.status = query.status;

    const total = await RecontactReminder.countDocuments(filter);
    const rows = await RecontactReminder.find(filter)
      .sort({ remindAt: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit);

    const candidateIds = rows.map((row) => row.candidateId);
    const jobIds = rows.map((row) => row.jobId).filter(Boolean) as mongoose.Types.ObjectId[];

    const [candidates, jobs] = await Promise.all([
      Candidate.find({ _id: { $in: candidateIds } }).select('userId headline currentJobTitle'),
      jobIds.length
        ? Job.find({ _id: { $in: jobIds } }).select('title')
        : Promise.resolve([]),
    ]);

    const users = await User.find({
      _id: { $in: candidates.map((item) => item.userId) },
    }).select('name');

    const candidateMap = new Map(candidates.map((item) => [item._id.toString(), item]));
    const userMap = new Map(users.map((item) => [item._id.toString(), item]));
    const jobMap = new Map(jobs.map((item) => [item._id.toString(), item]));

    return {
      recontacts: rows.map((row) => {
        const candidate = candidateMap.get(row.candidateId.toString());
        const user = candidate ? userMap.get(candidate.userId.toString()) : null;
        const job = row.jobId ? jobMap.get(row.jobId.toString()) : null;
        return {
          id: row._id.toString(),
          candidateId: row.candidateId.toString(),
          candidateName: user?.name ?? '',
          candidateHeadline: candidate?.headline ?? '',
          note: row.note ?? '',
          remindAt: row.remindAt,
          jobId: row.jobId ? row.jobId.toString() : null,
          jobTitle: job?.title ?? null,
          status: row.status,
          sentAt: row.sentAt ?? null,
          createdAt: row.createdAt,
        };
      }),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async cancelRecontact(employer: AuthenticatedEmployer, id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Recontact reminder not found', HTTP_STATUS.NOT_FOUND);
    }
    const row = await RecontactReminder.findOneAndUpdate(
      {
        _id: id,
        companyId: companyId(employer),
        status: 'scheduled',
      },
      { $set: { status: 'cancelled' } },
      { new: true },
    );
    if (!row) throw new AppError('Recontact reminder not found', HTTP_STATUS.NOT_FOUND);
    return { cancelled: true };
  }

  async runRecontactPass(now = new Date()) {
    const due = await RecontactReminder.find({
      status: 'scheduled',
      remindAt: { $lte: now },
    }).limit(200);

    let sent = 0;
    for (const reminder of due) {
      const candidateUserId = await resolveCandidateUserId(reminder.candidateId.toString());
      if (!candidateUserId) {
        reminder.status = 'cancelled';
        await reminder.save();
        continue;
      }

      const job = reminder.jobId ? await Job.findById(reminder.jobId).select('title') : null;
      await notifySafely({
        recipientId: candidateUserId,
        type: 'RECONTACT_REMINDER',
        title: 'Recruiter Wants to Reconnect',
        message: job
          ? `A recruiter scheduled a follow-up about "${job.title}".`
          : 'A recruiter scheduled a follow-up with you.',
        data: {
          candidateId: reminder.candidateId.toString(),
          employerId: reminder.employerId.toString(),
          companyId: reminder.companyId.toString(),
          ...(reminder.jobId ? { jobId: reminder.jobId.toString() } : {}),
          ...(reminder.note ? { note: reminder.note } : {}),
        },
      });

      reminder.status = 'sent';
      reminder.sentAt = now;
      await reminder.save();
      sent += 1;
    }

    return { processed: due.length, sent };
  }

  /** At most one RECRUITER_VIEWED_PROFILE per employer→candidate per 24h. */
  private async notifyProfileViewedOnce(
    employer: AuthenticatedEmployer,
    candidateId: string,
    job: { _id: mongoose.Types.ObjectId; title: string } | null,
  ) {
    const candidateUserId = await resolveCandidateUserId(candidateId);
    if (!candidateUserId) return;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await Notification.findOne({
      recipientId: candidateUserId,
      type: 'RECRUITER_VIEWED_PROFILE',
      'data.employerId': employer.employerId,
      'data.candidateId': candidateId,
      createdAt: { $gte: since },
    }).select('_id');
    if (recent) return;

    await notifySafely({
      recipientId: candidateUserId,
      type: 'RECRUITER_VIEWED_PROFILE',
      title: 'Recruiter Viewed Your Profile',
      message: job
        ? `A recruiter viewed your profile for "${job.title}".`
        : 'A recruiter viewed your profile.',
      data: {
        candidateId,
        employerId: employer.employerId,
        ...(job ? { jobId: job._id.toString() } : {}),
      },
    });
  }
}

export const employerCandidateService = new EmployerCandidateService();
