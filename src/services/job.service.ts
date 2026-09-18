import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import type { JobStatus } from '../constants/enums';
import { Category } from '../models/Category';
import { Company } from '../models/Company';
import { Job } from '../models/Job';
import { Location } from '../models/Location';
import type { AuthenticatedEmployer } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { isJobPubliclyVisible } from '../utils/jobVisibility';
import {
  mapEmployerJob,
  mapPublicJob,
  mapPublicJobSummary,
  type JobCategorySummary,
  type JobCompanySummary,
  type JobLocationSummary,
} from '../utils/jobMapper';
import { createUniqueSlug } from '../utils/slug';
import {
  buildExperienceOverlapFilter,
  buildKeywordFilter,
  buildPublicVisibilityFilter,
  buildSalaryOverlapFilter,
  mergeFilters,
  resolvePublicSort,
  sanitizeTextSearch,
} from '../utils/jobSearchQuery';
import { getEmployerEntitlements, markExpiredJobsForCompany, FREE_ENTITLEMENTS } from './entitlement.service';
import { trackSafely } from './analytics.service';
import { settingsService } from './settings.service';
import { resolveJobExpiresAt } from '../utils/jobListingExpiry';
import { haversineKm } from '../utils/geo';
import { placesService, type ResolvedPlace } from './places.service';
import type {
  EmployerJobQuery,
  JobCreateInput,
  JobUpdateInput,
  PublicJobQuery,
} from '../validators/job.validator';

type JobDocument = mongoose.Document & {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  employerId: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  skills: string[];
  categoryId?: mongoose.Types.ObjectId | null;
  location?: {
    locationId?: mongoose.Types.ObjectId | null;
    city?: string;
    state?: string;
    country?: string;
    area?: string;
    displayName?: string;
    address?: string;
    placeId?: string;
    latitude?: number;
    longitude?: number;
  };
  workMode: string;
  employmentType: string;
  experienceMin?: number;
  experienceMax?: number;
  salaryMin?: number;
  salaryMax?: number;
  salaryPeriod?: string;
  openings?: number;
  education?: string;
  genderPreference?: string;
  benefits: string[];
  applicationDeadline?: Date;
  applicationMethod?: string;
  status: JobStatus;
  featured?: boolean;
  urgent?: boolean;
  views?: number;
  applicationsCount?: number;
  publishedAt?: Date;
  expiresAt?: Date;
  renewalCount?: number;
  lastRenewedAt?: Date;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  save(): Promise<JobDocument>;
};

interface LocationSnapshot {
  locationId?: mongoose.Types.ObjectId;
  city: string;
  state: string;
  country: string;
  area: string;
  displayName: string;
  address: string;
  placeId: string;
  latitude?: number;
  longitude?: number;
}

const PUBLISH_READY_STATUSES: JobStatus[] = ['draft', 'pending'];

async function uniqueJobSlug(title: string, excludeId?: string): Promise<string> {
  return createUniqueSlug(title, async (value) => {
    const query: Record<string, unknown> = { slug: value };
    if (excludeId) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }
    const existing = await Job.findOne(query).select('_id');
    return Boolean(existing);
  });
}

async function assertCompanyCanPost(companyId: string): Promise<void> {
  const company = await Company.findById(companyId);
  if (!company) {
    throw new AppError('Company not found for this employer', HTTP_STATUS.FORBIDDEN);
  }
  if (company.status !== 'active') {
    throw new AppError('Company is not allowed to post jobs', HTTP_STATUS.FORBIDDEN);
  }
  if (company.verificationStatus === 'rejected') {
    throw new AppError('Company is not allowed to post jobs', HTTP_STATUS.FORBIDDEN);
  }
}

async function assertActiveCategory(categoryId: string): Promise<JobCategorySummary> {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new AppError('Invalid categoryId', HTTP_STATUS.BAD_REQUEST);
  }
  const category = await Category.findById(categoryId).select('name slug status');
  if (!category || category.status !== 'active') {
    throw new AppError('Category not found or inactive', HTTP_STATUS.BAD_REQUEST);
  }
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
  };
}

async function buildLocationSnapshot(locationId: string): Promise<LocationSnapshot> {
  if (!mongoose.Types.ObjectId.isValid(locationId)) {
    throw new AppError('Invalid locationId', HTTP_STATUS.BAD_REQUEST);
  }

  const location = await Location.findById(locationId);
  if (!location || location.status !== 'active') {
    throw new AppError('Location not found or inactive', HTTP_STATUS.BAD_REQUEST);
  }

  let city = '';
  let state = '';
  let country = '';
  let area = '';
  const names: string[] = [];

  let cursor: typeof location | null = location;
  const guard = new Set<string>();

  while (cursor) {
    const id = cursor._id.toString();
    if (guard.has(id)) {
      break;
    }
    guard.add(id);

    names.push(cursor.name);
    if (cursor.type === 'area') {
      area = cursor.name;
    } else if (cursor.type === 'city') {
      city = cursor.name;
    } else if (cursor.type === 'state') {
      state = cursor.name;
    } else if (cursor.type === 'country') {
      country = cursor.name;
    }

    if (!cursor.parentId) {
      break;
    }
    cursor = await Location.findById(cursor.parentId);
  }

  return {
    locationId: location._id,
    city,
    state,
    country,
    area,
    displayName: names.join(', '),
    address: '',
    placeId: '',
    latitude: typeof location.latitude === 'number' ? location.latitude : undefined,
    longitude: typeof location.longitude === 'number' ? location.longitude : undefined,
  };
}

function emptyOfficeLocation(): LocationSnapshot {
  return {
    city: '',
    state: '',
    country: '',
    area: '',
    displayName: '',
    address: '',
    placeId: '',
  };
}

function officeFromJob(job: JobDocument): LocationSnapshot {
  const location = job.location;
  return {
    locationId: location?.locationId ?? undefined,
    city: location?.city ?? '',
    state: location?.state ?? '',
    country: location?.country ?? '',
    area: location?.area ?? '',
    displayName: location?.displayName ?? '',
    address: location?.address ?? '',
    placeId: location?.placeId ?? '',
    latitude: location?.latitude,
    longitude: location?.longitude,
  };
}

async function withOffice(
  snapshot: LocationSnapshot,
  placeId: string,
): Promise<LocationSnapshot> {
  const place: ResolvedPlace = await placesService.resolve(placeId);
  return {
    ...snapshot,
    address: place.address,
    placeId: place.placeId,
    latitude: place.latitude,
    longitude: place.longitude,
    city: snapshot.city || place.city,
    state: snapshot.state || place.state,
    country: snapshot.country || place.country || 'India',
    area: snapshot.area || place.area,
    displayName: snapshot.displayName || place.address,
  };
}

async function loadCategoryMap(
  categoryIds: mongoose.Types.ObjectId[],
): Promise<Map<string, JobCategorySummary>> {
  if (categoryIds.length === 0) {
    return new Map();
  }
  const categories = await Category.find({ _id: { $in: categoryIds } }).select('name slug');
  return new Map(
    categories.map((category) => [
      category._id.toString(),
      {
        id: category._id.toString(),
        name: category.name,
        slug: category.slug,
      },
    ]),
  );
}

async function loadCompanyMap(
  companyIds: mongoose.Types.ObjectId[],
): Promise<Map<string, JobCompanySummary>> {
  if (companyIds.length === 0) {
    return new Map();
  }
  const companies = await Company.find({ _id: { $in: companyIds } }).select(
    'name slug logo industry companySize headquarters verificationStatus status',
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
        verificationStatus: company.verificationStatus,
      },
    ]),
  );
}

async function resolveActiveCategoryId(
  categoryId?: string,
  categorySlug?: string,
): Promise<mongoose.Types.ObjectId | null> {
  if (!categoryId && !categorySlug) {
    return null;
  }

  if (categoryId) {
    const category = await Category.findById(categoryId).select('status');
    if (!category || category.status !== 'active') {
      throw new AppError('Category not found or inactive', HTTP_STATUS.BAD_REQUEST);
    }
    return category._id;
  }

  const category = await Category.findOne({
    slug: categorySlug!.trim().toLowerCase(),
    status: 'active',
  }).select('_id');

  if (!category) {
    throw new AppError('Category not found or inactive', HTTP_STATUS.BAD_REQUEST);
  }
  return category._id;
}

/**
 * Collect a location and its active descendants (bounded BFS; hierarchy max depth is 4).
 */
async function collectActiveLocationSubtreeIds(
  rootId: mongoose.Types.ObjectId,
): Promise<mongoose.Types.ObjectId[]> {
  const ids: mongoose.Types.ObjectId[] = [rootId];
  let frontier: mongoose.Types.ObjectId[] = [rootId];

  // country → state → city → area (at most a few iterations)
  for (let depth = 0; depth < 4 && frontier.length > 0; depth += 1) {
    const children = await Location.find({
      parentId: { $in: frontier },
      status: 'active',
    }).select('_id');
    frontier = children.map((child) => child._id);
    ids.push(...frontier);
  }

  return ids;
}

async function resolveActiveLocationIds(
  locationId?: string,
  locationSlugOrName?: string,
): Promise<mongoose.Types.ObjectId[] | null> {
  if (!locationId && !locationSlugOrName) {
    return null;
  }

  let rootId: mongoose.Types.ObjectId | null = null;

  if (locationId) {
    const root = await Location.findById(locationId).select('_id status');
    if (!root || root.status !== 'active') {
      throw new AppError('Location not found or inactive', HTTP_STATUS.BAD_REQUEST);
    }
    rootId = root._id;
  } else if (locationSlugOrName) {
    const key = locationSlugOrName.trim().toLowerCase();
    const root = await Location.findOne({
      status: 'active',
      $or: [
        { slug: key },
        { name: new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      ],
    }).select('_id');
    if (!root) {
      throw new AppError('Location not found or inactive', HTTP_STATUS.BAD_REQUEST);
    }
    rootId = root._id;
  }

  if (!rootId) {
    return null;
  }

  return collectActiveLocationSubtreeIds(rootId);
}

async function loadLocationSummaryMap(
  locationIds: mongoose.Types.ObjectId[],
): Promise<Map<string, { name: string; slug: string; type: string }>> {
  if (locationIds.length === 0) {
    return new Map();
  }
  const locations = await Location.find({ _id: { $in: locationIds } }).select('name slug type');
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
      address?: string | null;
      placeId?: string | null;
      latitude?: number | null;
      longitude?: number | null;
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
    address: snapshot.address ?? '',
    placeId: snapshot.placeId ?? '',
    latitude: typeof snapshot.latitude === 'number' ? snapshot.latitude : null,
    longitude: typeof snapshot.longitude === 'number' ? snapshot.longitude : null,
  };
}

function assertOwned(job: JobDocument, employer: AuthenticatedEmployer): void {
  if (
    job.employerId.toString() !== employer.employerId ||
    job.companyId.toString() !== employer.companyId
  ) {
    throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
  }
}

async function findOwnedJob(id: string, employer: AuthenticatedEmployer): Promise<JobDocument> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
  }

  const job = (await Job.findOne({
    _id: id,
    deletedAt: null,
  })) as JobDocument | null;

  if (!job) {
    throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
  }

  assertOwned(job, employer);
  return job;
}

function assertPublishReady(job: JobDocument): void {
  const errors: Array<{ path: string; message: string }> = [];

  if (!job.title?.trim()) {
    errors.push({ path: 'title', message: 'Title is required' });
  }
  if (!job.description?.trim() || job.description.trim().length < 20) {
    errors.push({ path: 'description', message: 'Description is required' });
  }
  if (!job.categoryId) {
    errors.push({ path: 'categoryId', message: 'Category is required to publish' });
  }
  if (!job.location?.locationId && job.workMode !== 'remote') {
    errors.push({ path: 'locationId', message: 'Location is required to publish' });
  }
  if (job.workMode !== 'remote' && typeof job.location?.latitude !== 'number') {
    errors.push({
      path: 'officePlaceId',
      message: 'Office address is required to publish an on-site or hybrid job',
    });
  }
  if (!job.workMode) {
    errors.push({ path: 'workMode', message: 'Work mode is required' });
  }
  if (!job.employmentType) {
    errors.push({ path: 'employmentType', message: 'Employment type is required' });
  }
  if (job.experienceMin === undefined || job.experienceMin === null) {
    errors.push({ path: 'experience', message: 'Experience is required' });
  }
  if (!job.openings || job.openings < 1) {
    errors.push({ path: 'openings', message: 'Openings must be at least 1' });
  }
  if (!job.applicationMethod) {
    errors.push({ path: 'applicationMethod', message: 'Application method is required' });
  }
  if (!job.applicationDeadline) {
    errors.push({ path: 'deadline', message: 'Deadline is required to publish' });
  } else if (job.applicationDeadline.getTime() <= Date.now()) {
    errors.push({ path: 'deadline', message: 'Deadline must be in the future' });
  }

  if (errors.length > 0) {
    throw new AppError('Job is incomplete and cannot be published', HTTP_STATUS.BAD_REQUEST, errors);
  }
}

function applyEditableFields(
  job: JobDocument,
  input: JobUpdateInput | JobCreateInput,
  location?: LocationSnapshot | null,
): void {
  if ('title' in input && input.title !== undefined) {
    job.title = input.title;
  }
  if ('description' in input && input.description !== undefined) {
    job.description = input.description;
  }
  if ('responsibilities' in input && input.responsibilities !== undefined) {
    job.responsibilities = input.responsibilities;
  }
  if ('requirements' in input && input.requirements !== undefined) {
    job.requirements = input.requirements;
  }
  if ('skills' in input && input.skills !== undefined) {
    job.skills = input.skills;
  }
  if ('workMode' in input && input.workMode !== undefined) {
    job.workMode = input.workMode;
  }
  if ('employmentType' in input && input.employmentType !== undefined) {
    job.employmentType = input.employmentType;
  }
  if ('experience' in input && input.experience !== undefined) {
    job.experienceMin = input.experience.min;
    job.experienceMax = input.experience.max;
  }
  if ('salary' in input && input.salary !== undefined) {
    if (input.salary.min !== undefined) {
      job.salaryMin = input.salary.min;
    }
    if (input.salary.max !== undefined) {
      job.salaryMax = input.salary.max;
    }
    if (input.salary.period !== undefined) {
      job.salaryPeriod = input.salary.period;
    }
  }
  if ('openings' in input && input.openings !== undefined) {
    job.openings = input.openings;
  }
  if ('education' in input && input.education !== undefined) {
    job.education = input.education;
  }
  if ('genderPreference' in input && input.genderPreference !== undefined) {
    job.genderPreference = input.genderPreference;
  }
  if ('benefits' in input && input.benefits !== undefined) {
    job.benefits = input.benefits;
  }
  if ('applicationMethod' in input && input.applicationMethod !== undefined) {
    job.applicationMethod = input.applicationMethod;
  }
  if ('deadline' in input) {
    if (input.deadline === null) {
      job.applicationDeadline = undefined;
    } else if (input.deadline !== undefined) {
      job.applicationDeadline = input.deadline;
    }
  }
  if ('categoryId' in input) {
    if (input.categoryId === null) {
      job.categoryId = undefined;
    } else if (input.categoryId !== undefined) {
      job.categoryId = new mongoose.Types.ObjectId(input.categoryId);
    }
  }
  if (location) {
    job.location = location;
  } else if ('locationId' in input && input.locationId === null) {
    job.location = {
      locationId: undefined,
      city: '',
      state: '',
      country: '',
      area: '',
      displayName: '',
      address: '',
      placeId: '',
    };
  }
}

export class JobService {
  async create(employer: AuthenticatedEmployer, input: JobCreateInput) {
    await assertCompanyCanPost(employer.companyId);

    const entitlements = await getEmployerEntitlements(employer);
    if (entitlements.usage.jobsPostedInPeriod >= entitlements.limits.jobPostLimit) {
      throw new AppError(
        'Job post limit reached for your current subscription',
        HTTP_STATUS.FORBIDDEN,
        [
          {
            path: 'subscription',
            message: `jobPostLimit is ${entitlements.limits.jobPostLimit}`,
          },
        ],
      );
    }

    if (input.categoryId) {
      await assertActiveCategory(input.categoryId);
    }

    let location: LocationSnapshot | undefined;
    if (input.locationId) {
      location = await buildLocationSnapshot(input.locationId);
    }
    if (input.officePlaceId) {
      location = await withOffice(location ?? emptyOfficeLocation(), input.officePlaceId);
    }

    if (input.deadline && input.deadline.getTime() <= Date.now()) {
      throw new AppError('Deadline must be in the future', HTTP_STATUS.BAD_REQUEST, [
        { path: 'deadline', message: 'Deadline must be in the future' },
      ]);
    }

    const slug = await uniqueJobSlug(input.title);

    const job = (await Job.create({
      companyId: new mongoose.Types.ObjectId(employer.companyId),
      employerId: new mongoose.Types.ObjectId(employer.employerId),
      title: input.title,
      slug,
      description: input.description,
      responsibilities: input.responsibilities,
      requirements: input.requirements,
      skills: input.skills,
      categoryId: input.categoryId
        ? new mongoose.Types.ObjectId(input.categoryId)
        : undefined,
      location: location ?? {},
      workMode: input.workMode,
      employmentType: input.employmentType,
      experienceMin: input.experience?.min ?? 0,
      experienceMax: input.experience?.max,
      salaryMin: input.salary?.min,
      salaryMax: input.salary?.max,
      salaryPeriod: input.salary?.period ?? 'monthly',
      openings: input.openings,
      education: input.education,
      genderPreference: input.genderPreference,
      benefits: input.benefits,
      applicationDeadline: input.deadline,
      applicationMethod: input.applicationMethod,
      status: 'draft',
      featured: false,
      urgent: false,
      views: 0,
      applicationsCount: 0,
    })) as JobDocument;

    await trackSafely({
      eventType: 'job_created',
      userId: employer.userId,
      actorRole: 'employer',
      entityType: 'job',
      entityId: job._id,
      jobId: job._id,
      companyId: job.companyId,
      employerId: job.employerId,
      categoryId: job.categoryId,
      locationId: job.location?.locationId,
    });

    return {
      job: mapEmployerJob(job, {
        category: input.categoryId ? await assertActiveCategory(input.categoryId) : null,
      }),
    };
  }

  async listEmployer(employer: AuthenticatedEmployer, query: EmployerJobQuery) {
    await markExpiredJobsForCompany(employer.companyId);

    const filter: Record<string, unknown> = {
      employerId: new mongoose.Types.ObjectId(employer.employerId),
      companyId: new mongoose.Types.ObjectId(employer.companyId),
      deletedAt: null,
    };

    if (query.status) {
      filter.status = query.status;
    }

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
      Job.countDocuments(filter),
    ]);

    const categoryMap = await loadCategoryMap(
      items
        .map((item) => item.categoryId)
        .filter((id): id is mongoose.Types.ObjectId => Boolean(id)),
    );
    const companyMap = await loadCompanyMap([new mongoose.Types.ObjectId(employer.companyId)]);

    return {
      jobs: items.map((item) =>
        mapEmployerJob(item, {
          category: item.categoryId
            ? categoryMap.get(item.categoryId.toString()) ?? null
            : null,
          company: companyMap.get(employer.companyId) ?? null,
        }),
      ),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async getEmployerById(employer: AuthenticatedEmployer, id: string) {
    const job = await findOwnedJob(id, employer);
    const [category, company] = await Promise.all([
      job.categoryId
        ? Category.findById(job.categoryId).select('name slug')
        : Promise.resolve(null),
      Company.findById(job.companyId).select(
        'name slug logo industry companySize headquarters verificationStatus',
      ),
    ]);

    return {
      job: mapEmployerJob(job, {
        category: category
          ? { id: category._id.toString(), name: category.name, slug: category.slug }
          : null,
        company: company
          ? {
              id: company._id.toString(),
              name: company.name,
              slug: company.slug,
              logo: company.logo ?? '',
              industry: company.industry ?? '',
              companySize: company.companySize ?? null,
              headquarters: company.headquarters ?? '',
              verificationStatus: company.verificationStatus,
            }
          : null,
      }),
    };
  }

  async update(employer: AuthenticatedEmployer, id: string, input: JobUpdateInput) {
    await assertCompanyCanPost(employer.companyId);
    const job = await findOwnedJob(id, employer);

    if (['closed', 'expired', 'rejected'].includes(job.status)) {
      throw new AppError('Closed, expired, or rejected jobs cannot be updated', HTTP_STATUS.CONFLICT);
    }

    if (input.categoryId) {
      await assertActiveCategory(input.categoryId);
    }

    let location: LocationSnapshot | null | undefined;
    if (input.locationId) {
      location = await buildLocationSnapshot(input.locationId);
      if (input.officePlaceId === undefined && job.location?.placeId) {
        location = await withOffice(location, job.location.placeId);
      }
    } else if (input.locationId === null) {
      location = null;
    }
    if (input.officePlaceId) {
      const base = location === null ? emptyOfficeLocation() : (location ?? officeFromJob(job));
      location = await withOffice(base, input.officePlaceId);
    } else if (input.officePlaceId === null && location !== null) {
      const base = location ?? officeFromJob(job);
      location = {
        ...base,
        address: '',
        placeId: '',
        latitude: undefined,
        longitude: undefined,
      };
    }

    if (input.deadline && input.deadline.getTime() <= Date.now()) {
      throw new AppError('Deadline must be in the future', HTTP_STATUS.BAD_REQUEST, [
        { path: 'deadline', message: 'Deadline must be in the future' },
      ]);
    }

    applyEditableFields(job, input, location === undefined ? undefined : location);

    // Keep slug stable on title changes for SEO URLs.
    await job.save();

    return this.getEmployerById(employer, id);
  }

  async remove(employer: AuthenticatedEmployer, id: string) {
    const job = await findOwnedJob(id, employer);

    // Soft-delete to protect future applications / saved jobs / interviews.
    job.deletedAt = new Date();
    if (job.status === 'published' || job.status === 'paused') {
      job.status = 'closed';
    }
    await job.save();

    return {
      deleted: true,
      softDeleted: true,
      id: job._id.toString(),
      status: job.status,
    };
  }

  async publish(employer: AuthenticatedEmployer, id: string) {
    await assertCompanyCanPost(employer.companyId);
    const job = await findOwnedJob(id, employer);

    if (!PUBLISH_READY_STATUSES.includes(job.status)) {
      throw new AppError(
        `Cannot publish a job with status "${job.status}"`,
        HTTP_STATUS.CONFLICT,
      );
    }

    assertPublishReady(job);

    const entitlements = await getEmployerEntitlements(employer);

    if (job.status !== 'published' && job.status !== 'paused') {
      if (entitlements.usage.activeJobs >= entitlements.limits.activeJobLimit) {
        throw new AppError(
          'Active job limit reached for your current subscription',
          HTTP_STATUS.FORBIDDEN,
          [
            {
              path: 'subscription',
              message: `activeJobLimit is ${entitlements.limits.activeJobLimit}`,
            },
          ],
        );
      }
    }

    if (job.categoryId) {
      await assertActiveCategory(job.categoryId.toString());
    }
    if (job.location?.locationId) {
      await buildLocationSnapshot(job.location.locationId.toString());
    }

    // B11: no admin moderation gate yet — draft/pending publish directly.
    // Future admin approval can insert draft → pending → published.
    const publishedAt = new Date();
    job.status = 'published';
    job.publishedAt = job.publishedAt ?? publishedAt;
    job.expiresAt = resolveJobExpiresAt({
      publishedAt: job.publishedAt,
      applicationDeadline: job.applicationDeadline,
      jobListingLifetimeDays: entitlements.limits.jobListingLifetimeDays,
    });
    await job.save();

    await trackSafely({
      eventType: 'job_published',
      userId: employer.userId,
      actorRole: 'employer',
      entityType: 'job',
      entityId: job._id,
      jobId: job._id,
      companyId: job.companyId,
      employerId: job.employerId,
      categoryId: job.categoryId,
      locationId: job.location?.locationId,
    });

    return this.getEmployerById(employer, id);
  }

  /**
   * Renew an expired job listing. Consumes one jobPostLimit credit and
   * resets listing lifetime from now (Free = 10 days).
   */
  async renew(employer: AuthenticatedEmployer, id: string) {
    await assertCompanyCanPost(employer.companyId);
    await markExpiredJobsForCompany(employer.companyId);
    const job = await findOwnedJob(id, employer);

    if (job.status !== 'expired') {
      throw new AppError(
        'Only expired jobs can be renewed',
        HTTP_STATUS.CONFLICT,
        [{ path: 'status', message: `Current status is "${job.status}"` }],
      );
    }

    assertPublishReady(job);

    const entitlements = await getEmployerEntitlements(employer);
    if (entitlements.usage.jobsPostedInPeriod >= entitlements.limits.jobPostLimit) {
      throw new AppError(
        'Job post limit reached for your current subscription. Renewing uses one post credit.',
        HTTP_STATUS.FORBIDDEN,
        [
          {
            path: 'subscription',
            message: `jobPostLimit is ${entitlements.limits.jobPostLimit}`,
          },
        ],
      );
    }

    if (entitlements.usage.activeJobs >= entitlements.limits.activeJobLimit) {
      throw new AppError(
        'Active job limit reached for your current subscription',
        HTTP_STATUS.FORBIDDEN,
        [
          {
            path: 'subscription',
            message: `activeJobLimit is ${entitlements.limits.activeJobLimit}`,
          },
        ],
      );
    }

    if (job.categoryId) {
      await assertActiveCategory(job.categoryId.toString());
    }
    if (job.location?.locationId) {
      await buildLocationSnapshot(job.location.locationId.toString());
    }

    const now = new Date();
    const lifetimeDays =
      entitlements.limits.jobListingLifetimeDays > 0
        ? entitlements.limits.jobListingLifetimeDays
        : FREE_ENTITLEMENTS.limits.jobListingLifetimeDays;

    // Extend deadline if it has already passed so renew can go live.
    if (!job.applicationDeadline || job.applicationDeadline.getTime() <= now.getTime()) {
      job.applicationDeadline = new Date(now.getTime() + lifetimeDays * 24 * 60 * 60 * 1000);
    }

    job.status = 'published';
    job.publishedAt = now;
    job.lastRenewedAt = now;
    job.renewalCount = (job.renewalCount ?? 0) + 1;
    job.expiresAt = resolveJobExpiresAt({
      publishedAt: now,
      applicationDeadline: job.applicationDeadline,
      jobListingLifetimeDays: lifetimeDays,
    });
    await job.save();

    await trackSafely({
      eventType: 'job_published',
      userId: employer.userId,
      actorRole: 'employer',
      entityType: 'job',
      entityId: job._id,
      jobId: job._id,
      companyId: job.companyId,
      employerId: job.employerId,
      categoryId: job.categoryId,
      locationId: job.location?.locationId,
      metadata: { source: 'renew', renewalCount: job.renewalCount },
    });

    return this.getEmployerById(employer, id);
  }

  async pause(employer: AuthenticatedEmployer, id: string) {
    const job = await findOwnedJob(id, employer);
    if (job.status !== 'published') {
      throw new AppError('Only published jobs can be paused', HTTP_STATUS.CONFLICT);
    }
    job.status = 'paused';
    await job.save();

    await trackSafely({
      eventType: 'job_paused',
      userId: employer.userId,
      actorRole: 'employer',
      entityType: 'job',
      entityId: job._id,
      jobId: job._id,
      companyId: job.companyId,
      employerId: job.employerId,
      categoryId: job.categoryId,
      locationId: job.location?.locationId,
    });

    return this.getEmployerById(employer, id);
  }

  async resume(employer: AuthenticatedEmployer, id: string) {
    await assertCompanyCanPost(employer.companyId);
    const job = await findOwnedJob(id, employer);
    if (job.status !== 'paused') {
      throw new AppError('Only paused jobs can be resumed', HTTP_STATUS.CONFLICT);
    }
    if (job.applicationDeadline && job.applicationDeadline.getTime() <= Date.now()) {
      throw new AppError('Cannot resume a job past its deadline', HTTP_STATUS.CONFLICT);
    }
    job.status = 'published';
    await job.save();

    await trackSafely({
      eventType: 'job_published',
      userId: employer.userId,
      actorRole: 'employer',
      entityType: 'job',
      entityId: job._id,
      jobId: job._id,
      companyId: job.companyId,
      employerId: job.employerId,
      categoryId: job.categoryId,
      locationId: job.location?.locationId,
      metadata: { source: 'resume' },
    });

    return this.getEmployerById(employer, id);
  }

  async close(employer: AuthenticatedEmployer, id: string) {
    const job = await findOwnedJob(id, employer);
    if (job.status !== 'published' && job.status !== 'paused') {
      throw new AppError('Only published or paused jobs can be closed', HTTP_STATUS.CONFLICT);
    }
    job.status = 'closed';
    await job.save();

    await trackSafely({
      eventType: 'job_closed',
      userId: employer.userId,
      actorRole: 'employer',
      entityType: 'job',
      entityId: job._id,
      jobId: job._id,
      companyId: job.companyId,
      employerId: job.employerId,
      categoryId: job.categoryId,
      locationId: job.location?.locationId,
    });

    return this.getEmployerById(employer, id);
  }

  async listPublic(query: PublicJobQuery) {
    const limit = await settingsService.clampPublicJobPageSize(query.limit);
    const page = query.page;
    const publicCompanies = await Company.find({
      status: 'active',
      verificationStatus: { $ne: 'rejected' },
    }).select('_id');

    const companyIds = publicCompanies.map((company) => company._id);
    const now = new Date();

    const resolvedCategoryId = await resolveActiveCategoryId(query.categoryId, query.category);
    const resolvedLocationIds = await resolveActiveLocationIds(query.locationId, query.location);

    const keywordRaw = query.q?.trim();
    const keywordFilter =
      keywordRaw && sanitizeTextSearch(keywordRaw)
        ? buildKeywordFilter(keywordRaw)
        : null;
    const hasKeyword = Boolean(keywordFilter);

    const filter = mergeFilters(
      buildPublicVisibilityFilter(companyIds, now),
      keywordFilter,
      resolvedCategoryId ? { categoryId: resolvedCategoryId } : null,
      resolvedLocationIds
        ? { 'location.locationId': { $in: resolvedLocationIds } }
        : null,
      query.workMode ? { workMode: query.workMode } : null,
      query.employmentType ? { employmentType: query.employmentType } : null,
      buildExperienceOverlapFilter(query.experienceMin, query.experienceMax),
      buildSalaryOverlapFilter(query.salaryMin, query.salaryMax),
      query.featured === undefined ? null : { featured: query.featured },
      query.urgent === undefined ? null : { urgent: query.urgent },
    );

    const sort = resolvePublicSort(query.sort, hasKeyword);
    const skip = (page - 1) * limit;
    const origin =
      query.lat !== undefined && query.lng !== undefined
        ? { latitude: query.lat, longitude: query.lng }
        : null;

    let items;
    if (query.sort === 'nearest' && origin) {
      const pool = await Job.find(filter).limit(300);
      items = pool
        .map((item) => ({
          item,
          distance:
            typeof item.location?.latitude === 'number' &&
            typeof item.location.longitude === 'number'
              ? haversineKm(origin, {
                  latitude: item.location.latitude,
                  longitude: item.location.longitude,
                })
              : Number.POSITIVE_INFINITY,
        }))
        .sort((left, right) => left.distance - right.distance)
        .slice(skip, skip + limit)
        .map((row) => row.item);
    } else {
      let findQuery = Job.find(filter).sort(sort).skip(skip).limit(limit);
      if (hasKeyword && query.sort === 'relevance') {
        findQuery = findQuery.select({ score: { $meta: 'textScore' } });
      }
      items = await findQuery;
    }

    const total = await Job.countDocuments(filter);

    const categoryMap = await loadCategoryMap(
      items
        .map((item) => item.categoryId)
        .filter((id): id is mongoose.Types.ObjectId => Boolean(id)),
    );
    const companyMap = await loadCompanyMap(items.map((item) => item.companyId));
    const locationMap = await loadLocationSummaryMap(
      items
        .map((item) => item.location?.locationId)
        .filter((id): id is mongoose.Types.ObjectId => Boolean(id)),
    );

    return {
      jobs: items.map((item) =>
        mapPublicJobSummary(item, {
          category: item.categoryId
            ? categoryMap.get(item.categoryId.toString()) ?? null
            : null,
          company: companyMap.get(item.companyId.toString()) ?? null,
          location: toLocationSummary(item, locationMap),
          distanceKm:
            origin &&
            typeof item.location?.latitude === 'number' &&
            typeof item.location.longitude === 'number'
              ? haversineKm(origin, {
                  latitude: item.location.latitude,
                  longitude: item.location.longitude,
                })
              : null,
        }),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      meta: {
        sort: query.sort,
        q: query.q ?? null,
      },
    };
  }

  async getPublicBySlug(slug: string) {
    const job = (await Job.findOne({
      slug: slug.trim().toLowerCase(),
      status: 'published',
      deletedAt: null,
    })) as JobDocument | null;

    if (!job) {
      throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
    }

    if (job.expiresAt && job.expiresAt.getTime() <= Date.now()) {
      throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
    }

    const company = await Company.findById(job.companyId);
    if (!company || !isJobPubliclyVisible(job, company)) {
      throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
    }

    await Job.updateOne({ _id: job._id }, { $inc: { views: 1 } });
    job.views = (job.views ?? 0) + 1;

    await trackSafely({
      eventType: 'job_view',
      actorRole: 'anonymous',
      entityType: 'job',
      entityId: job._id,
      jobId: job._id,
      companyId: job.companyId,
      employerId: job.employerId,
      categoryId: job.categoryId,
      locationId: job.location?.locationId,
      metadata: { source: 'public_job_detail' },
    });

    const category = job.categoryId
      ? await Category.findById(job.categoryId).select('name slug')
      : null;

    return {
      job: mapPublicJob(job, {
        category: category
          ? { id: category._id.toString(), name: category.name, slug: category.slug }
          : null,
        company: {
          id: company._id.toString(),
          name: company.name,
          slug: company.slug,
          logo: company.logo ?? '',
          industry: company.industry ?? '',
          companySize: company.companySize ?? null,
          headquarters: company.headquarters ?? '',
          verificationStatus: company.verificationStatus,
        },
      }),
    };
  }
}

export const jobService = new JobService();
