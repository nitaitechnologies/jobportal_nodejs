import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { Category } from '../models/Category';
import { Company } from '../models/Company';
import { Job } from '../models/Job';
import { Location } from '../models/Location';
import { SavedJob } from '../models/SavedJob';
import type { AuthenticatedCandidate } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { mapPublicJobSummary, type JobLocationSummary } from '../utils/jobMapper';
import { isJobPubliclyVisible } from '../utils/jobVisibility';
import { trackSafely } from './analytics.service';
import type { SavedJobListQuery } from '../validators/savedJob.validator';

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

async function assertPublicJobForSave(jobId: string) {
  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new AppError('Invalid job id', HTTP_STATUS.BAD_REQUEST);
  }

  const job = await Job.findById(jobId);
  if (!job) {
    throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
  }

  const company = await Company.findById(job.companyId).select(
    'status verificationStatus name slug logo industry',
  );

  if (!isJobPubliclyVisible(job, company)) {
    throw new AppError('Job is not available to save', HTTP_STATUS.BAD_REQUEST);
  }

  return job;
}

async function loadCategoryMap(ids: mongoose.Types.ObjectId[]) {
  if (ids.length === 0) {
    return new Map<string, { id: string; name: string; slug: string }>();
  }
  const categories = await Category.find({ _id: { $in: ids } }).select('name slug');
  return new Map(
    categories.map((category) => [
      category._id.toString(),
      { id: category._id.toString(), name: category.name, slug: category.slug },
    ]),
  );
}

async function loadCompanyMap(ids: mongoose.Types.ObjectId[]) {
  if (ids.length === 0) {
    return new Map<
      string,
      {
        id: string;
        name: string;
        slug: string;
        logo: string;
        industry: string;
        companySize: string | null;
        headquarters: string;
      }
    >();
  }
  const companies = await Company.find({ _id: { $in: ids } }).select(
    'name slug logo industry companySize headquarters status verificationStatus',
  );
  return new Map(
    companies.map((company) => [
      company._id.toString(),
      {
        id: company._id.toString(),
        name: company.name,
        slug: company.slug,
        logo: company.logo ?? '',
        industry: company.industry ?? '',
        companySize: company.companySize ?? null,
        headquarters: company.headquarters ?? '',
      },
    ]),
  );
}

async function loadLocationMap(ids: mongoose.Types.ObjectId[]) {
  if (ids.length === 0) {
    return new Map<string, { name: string; slug: string; type: string }>();
  }
  const locations = await Location.find({ _id: { $in: ids } }).select('name slug type');
  return new Map(
    locations.map((location) => [
      location._id.toString(),
      { name: location.name, slug: location.slug, type: location.type },
    ]),
  );
}

function toLocationSummary(
  job: {
    location?: {
      locationId?: mongoose.Types.ObjectId | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
      area?: string | null;
      displayName?: string | null;
    } | null;
  },
  locationMap: Map<string, { name: string; slug: string; type: string }>,
): JobLocationSummary | null {
  const snapshot = job.location;
  if (!snapshot) {
    return null;
  }
  const id = snapshot.locationId?.toString() ?? null;
  const meta = id ? locationMap.get(id) : undefined;
  return {
    locationId: id,
    name: meta?.name,
    slug: meta?.slug,
    type: meta?.type,
    city: snapshot.city ?? '',
    state: snapshot.state ?? '',
    country: snapshot.country ?? '',
    area: snapshot.area ?? '',
    displayName: snapshot.displayName ?? meta?.name ?? '',
  };
}

export class SavedJobService {
  async save(candidate: AuthenticatedCandidate, jobId: string) {
    await assertPublicJobForSave(jobId);

    try {
      const saved = await SavedJob.create({
        candidateId: new mongoose.Types.ObjectId(candidate.candidateId),
        jobId: new mongoose.Types.ObjectId(jobId),
      });

      const job = await Job.findById(jobId).select(
        'companyId employerId categoryId location.locationId',
      );
      await trackSafely({
        eventType: 'job_saved',
        userId: candidate.userId,
        actorRole: 'candidate',
        entityType: 'job',
        entityId: jobId,
        jobId,
        companyId: job?.companyId,
        employerId: job?.employerId,
        candidateId: candidate.candidateId,
        categoryId: job?.categoryId,
        locationId: job?.location?.locationId,
      });

      return {
        saved: true,
        alreadySaved: false,
        savedJobId: saved._id.toString(),
        jobId,
        savedAt: saved.createdAt,
      };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const existing = await SavedJob.findOne({
          candidateId: candidate.candidateId,
          jobId,
        });
        return {
          saved: true,
          alreadySaved: true,
          savedJobId: existing?._id.toString() ?? null,
          jobId,
          savedAt: existing?.createdAt ?? null,
        };
      }
      throw error;
    }
  }

  async unsave(candidate: AuthenticatedCandidate, jobId: string) {
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      throw new AppError('Invalid job id', HTTP_STATUS.BAD_REQUEST);
    }

    const result = await SavedJob.findOneAndDelete({
      candidateId: candidate.candidateId,
      jobId,
    });

    if (!result) {
      throw new AppError('Saved job not found', HTTP_STATUS.NOT_FOUND);
    }

    const job = await Job.findById(jobId).select(
      'companyId employerId categoryId location.locationId',
    );
    await trackSafely({
      eventType: 'job_unsaved',
      userId: candidate.userId,
      actorRole: 'candidate',
      entityType: 'job',
      entityId: jobId,
      jobId,
      companyId: job?.companyId,
      employerId: job?.employerId,
      candidateId: candidate.candidateId,
      categoryId: job?.categoryId,
      locationId: job?.location?.locationId,
    });

    return {
      saved: false,
      jobId,
    };
  }

  async toggle(candidate: AuthenticatedCandidate, jobId: string) {
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      throw new AppError('Invalid job id', HTTP_STATUS.BAD_REQUEST);
    }

    const existing = await SavedJob.findOne({
      candidateId: candidate.candidateId,
      jobId,
    }).select('_id');

    if (existing) {
      return this.unsave(candidate, jobId);
    }

    const saved = await this.save(candidate, jobId);
    return {
      saved: true,
      jobId: saved.jobId,
      alreadySaved: saved.alreadySaved,
    };
  }

  async getStatus(candidate: AuthenticatedCandidate, jobId: string) {
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      throw new AppError('Invalid job id', HTTP_STATUS.BAD_REQUEST);
    }

    const existing = await SavedJob.findOne({
      candidateId: candidate.candidateId,
      jobId,
    }).select('_id');

    return {
      saved: Boolean(existing),
      jobId,
    };
  }

  async list(candidate: AuthenticatedCandidate, query: SavedJobListQuery) {
    const filter = {
      candidateId: new mongoose.Types.ObjectId(candidate.candidateId),
    };

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      SavedJob.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
      SavedJob.countDocuments(filter),
    ]);

    const jobIds = items.map((item) => item.jobId);
    const jobs = jobIds.length
      ? await Job.find({ _id: { $in: jobIds } })
      : [];
    const jobMap = new Map(jobs.map((job) => [job._id.toString(), job]));

    const companyIds = jobs.map((job) => job.companyId);
    const categoryIds = jobs
      .map((job) => job.categoryId)
      .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
    const locationIds = jobs
      .map((job) => job.location?.locationId)
      .filter((id): id is mongoose.Types.ObjectId => Boolean(id));

    const [companyMap, categoryMap, locationMap, companiesForVisibility] = await Promise.all([
      loadCompanyMap(companyIds),
      loadCategoryMap(categoryIds),
      loadLocationMap(locationIds),
      Company.find({ _id: { $in: companyIds } }).select('status verificationStatus'),
    ]);
    const visibilityMap = new Map(
      companiesForVisibility.map((company) => [company._id.toString(), company]),
    );

    const savedJobs = items.map((item) => {
      const job = jobMap.get(item.jobId.toString());
      if (!job) {
        return {
          savedJobId: item._id.toString(),
          savedAt: item.createdAt,
          available: false,
          job: null,
        };
      }

      const companyDoc = visibilityMap.get(job.companyId.toString());
      const available = isJobPubliclyVisible(job, companyDoc);
      const summary = mapPublicJobSummary(job, {
        category: job.categoryId
          ? categoryMap.get(job.categoryId.toString()) ?? null
          : null,
        company: companyMap.get(job.companyId.toString()) ?? null,
        location: toLocationSummary(job, locationMap),
      });

      return {
        savedJobId: item._id.toString(),
        savedAt: item.createdAt,
        available,
        job: {
          ...summary,
          deadline: job.applicationDeadline ?? null,
          status: job.status,
        },
      };
    });

    return {
      savedJobs,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }
}

export const savedJobService = new SavedJobService();
