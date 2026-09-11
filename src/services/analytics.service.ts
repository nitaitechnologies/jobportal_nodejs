import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import {
  ANALYTICS_ACTOR_ROLES,
  ANALYTICS_ENTITY_TYPES,
  ANALYTICS_EVENT_TYPES,
  type AnalyticsActorRole,
  type AnalyticsEntityType,
  type AnalyticsEventType,
  type AnalyticsGranularity,
} from '../constants/enums';
import { AnalyticsEvent } from '../models/AnalyticsEvent';
import { Application } from '../models/Application';
import { Candidate } from '../models/Candidate';
import { Company } from '../models/Company';
import { Employer } from '../models/Employer';
import { Job } from '../models/Job';
import { Subscription } from '../models/Subscription';
import type { AuthenticatedEmployer } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import {
  mongoDateTruncUnit,
  resolveAnalyticsDateRange,
  type DateRange,
} from '../utils/analyticsDateRange';
import type {
  AdminAnalyticsEventsQuery,
  AdminAnalyticsOverviewQuery,
  AdminAnalyticsPagedQuery,
} from '../validators/analytics.validator';

const SENSITIVE_META_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'jwt',
  'authorization',
  'cookie',
  'cookies',
  'otp',
  'pin',
]);

export interface TrackAnalyticsEventInput {
  eventType: AnalyticsEventType;
  userId?: string | mongoose.Types.ObjectId | null;
  actorRole?: AnalyticsActorRole;
  entityType?: AnalyticsEntityType;
  entityId?: string | mongoose.Types.ObjectId | null;
  jobId?: string | mongoose.Types.ObjectId | null;
  companyId?: string | mongoose.Types.ObjectId | null;
  employerId?: string | mongoose.Types.ObjectId | null;
  candidateId?: string | mongoose.Types.ObjectId | null;
  categoryId?: string | mongoose.Types.ObjectId | null;
  locationId?: string | mongoose.Types.ObjectId | null;
  metadata?: Record<string, unknown>;
  sessionId?: string;
  ipHash?: string;
  userAgent?: string;
  occurredAt?: Date;
}

function assertEventType(type: string): asserts type is AnalyticsEventType {
  if (!(ANALYTICS_EVENT_TYPES as readonly string[]).includes(type)) {
    throw new AppError('Invalid analytics event type', HTTP_STATUS.BAD_REQUEST, [
      { path: 'eventType', message: 'Unsupported event type' },
    ]);
  }
}

function toObjectId(
  value: string | mongoose.Types.ObjectId | null | undefined,
): mongoose.Types.ObjectId | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const str = String(value);
  if (!mongoose.Types.ObjectId.isValid(str)) {
    return undefined;
  }
  return new mongoose.Types.ObjectId(str);
}

function sanitizeMetadata(data?: Record<string, unknown>): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('$') || SENSITIVE_META_KEYS.has(key)) {
      continue;
    }
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      clean[key] = typeof value === 'string' ? value.slice(0, 500) : value;
    } else if (value instanceof Date) {
      clean[key] = value.toISOString();
    } else if (
      typeof value === 'object' &&
      value !== null &&
      mongoose.Types.ObjectId.isValid(String(value))
    ) {
      clean[key] = String(value);
    }
  }
  return clean;
}

function mapSafeEvent(doc: {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | null;
  actorRole?: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: mongoose.Types.ObjectId | null;
  jobId?: mongoose.Types.ObjectId | null;
  companyId?: mongoose.Types.ObjectId | null;
  employerId?: mongoose.Types.ObjectId | null;
  candidateId?: mongoose.Types.ObjectId | null;
  categoryId?: mongoose.Types.ObjectId | null;
  locationId?: mongoose.Types.ObjectId | null;
  metadata?: Record<string, unknown> | null;
  sessionId?: string | null;
  occurredAt?: Date | null;
  createdAt?: Date | null;
}) {
  return {
    id: doc._id.toString(),
    eventType: doc.eventType,
    actorRole: doc.actorRole ?? 'anonymous',
    userId: doc.userId ? doc.userId.toString() : null,
    entityType: doc.entityType || null,
    entityId: doc.entityId ? doc.entityId.toString() : null,
    jobId: doc.jobId ? doc.jobId.toString() : null,
    companyId: doc.companyId ? doc.companyId.toString() : null,
    employerId: doc.employerId ? doc.employerId.toString() : null,
    candidateId: doc.candidateId ? doc.candidateId.toString() : null,
    categoryId: doc.categoryId ? doc.categoryId.toString() : null,
    locationId: doc.locationId ? doc.locationId.toString() : null,
    metadata: sanitizeMetadata(doc.metadata ?? undefined),
    sessionId: doc.sessionId || null,
    occurredAt: doc.occurredAt ?? doc.createdAt ?? null,
    createdAt: doc.createdAt ?? null,
  };
}

/**
 * Central analytics factory. Throws on invalid controlled inputs.
 * Prefer `trackSafely` from domain flows so analytics failures do not break UX.
 */
export async function trackAnalyticsEvent(input: TrackAnalyticsEventInput) {
  assertEventType(input.eventType);

  if (input.actorRole && !(ANALYTICS_ACTOR_ROLES as readonly string[]).includes(input.actorRole)) {
    throw new AppError('Invalid actorRole', HTTP_STATUS.BAD_REQUEST);
  }

  if (
    input.entityType &&
    !(ANALYTICS_ENTITY_TYPES as readonly string[]).includes(input.entityType)
  ) {
    throw new AppError('Invalid entityType', HTTP_STATUS.BAD_REQUEST);
  }

  const occurredAt = input.occurredAt ?? new Date();
  const event = await AnalyticsEvent.create({
    eventType: input.eventType,
    userId: toObjectId(input.userId),
    actorRole: input.actorRole ?? (input.userId ? 'system' : 'anonymous'),
    entityType: input.entityType,
    entityId: toObjectId(input.entityId),
    jobId: toObjectId(input.jobId),
    companyId: toObjectId(input.companyId),
    employerId: toObjectId(input.employerId),
    candidateId: toObjectId(input.candidateId),
    categoryId: toObjectId(input.categoryId),
    locationId: toObjectId(input.locationId),
    metadata: sanitizeMetadata(input.metadata),
    sessionId: (input.sessionId ?? '').slice(0, 120),
    ipHash: (input.ipHash ?? '').slice(0, 128),
    userAgent: (input.userAgent ?? '').slice(0, 500),
    occurredAt,
  });

  return mapSafeEvent(event);
}

export async function trackSafely(input: TrackAnalyticsEventInput): Promise<void> {
  try {
    const { settingsService } = await import('./settings.service.js');
    const enabled = await settingsService.getBoolean('analytics.enabled', true);
    if (!enabled) {
      return;
    }
    await trackAnalyticsEvent(input);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    console.error(`[analytics] failed to track ${input.eventType}: ${reason}`);
  }
}

function rangeFilter(range: DateRange): Record<string, unknown> {
  return {
    occurredAt: { $gte: range.from, $lt: range.to },
  };
}

async function countEvents(
  eventTypes: AnalyticsEventType[],
  range: DateRange,
  extra: Record<string, unknown> = {},
): Promise<number> {
  return AnalyticsEvent.countDocuments({
    eventType: { $in: eventTypes },
    ...rangeFilter(range),
    ...extra,
  });
}

async function buildSeries(
  range: DateRange,
  granularity: AnalyticsGranularity,
): Promise<
  Array<{
    date: string;
    jobViews: number;
    applications: number;
    interviews: number;
    logins: number;
  }>
> {
  const unit = mongoDateTruncUnit(granularity);
  const rows = await AnalyticsEvent.aggregate<{
    _id: Date;
    jobViews: number;
    applications: number;
    interviews: number;
    logins: number;
  }>([
    {
      $match: {
        ...rangeFilter(range),
        eventType: {
          $in: [
            'job_view',
            'application_submitted',
            'interview_scheduled',
            'candidate_login',
            'employer_login',
            'admin_login',
          ],
        },
      },
    },
    {
      $group: {
        _id: {
          $dateTrunc: { date: '$occurredAt', unit, timezone: 'UTC' },
        },
        jobViews: {
          $sum: { $cond: [{ $eq: ['$eventType', 'job_view'] }, 1, 0] },
        },
        applications: {
          $sum: { $cond: [{ $eq: ['$eventType', 'application_submitted'] }, 1, 0] },
        },
        interviews: {
          $sum: { $cond: [{ $eq: ['$eventType', 'interview_scheduled'] }, 1, 0] },
        },
        logins: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$eventType',
                  ['candidate_login', 'employer_login', 'admin_login'],
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((row) => ({
    date: row._id.toISOString().slice(0, 10),
    jobViews: row.jobViews,
    applications: row.applications,
    interviews: row.interviews,
    logins: row.logins,
  }));
}

export class AnalyticsService {
  async getAdminOverview(query: AdminAnalyticsOverviewQuery) {
    const range = resolveAnalyticsDateRange({
      preset: query.preset,
      from: query.from,
      to: query.to,
    });

    const [
      totalCandidates,
      totalEmployers,
      totalCompanies,
      totalJobs,
      publishedJobs,
      totalApplications,
      activeSubscriptions,
      jobViewsPeriod,
      applicationsPeriod,
      interviewsPeriod,
      savedJobsPeriod,
      loginsPeriod,
      subscriptionActivityPeriod,
      series,
    ] = await Promise.all([
      Candidate.countDocuments({}),
      Employer.countDocuments({}),
      Company.countDocuments({}),
      Job.countDocuments({ deletedAt: null }),
      Job.countDocuments({ status: 'published', deletedAt: null }),
      Application.countDocuments({}),
      Subscription.countDocuments({ status: { $in: ['active', 'trial'] } }),
      countEvents(['job_view'], range),
      countEvents(['application_submitted'], range),
      countEvents(['interview_scheduled'], range),
      countEvents(['job_saved'], range),
      countEvents(['candidate_login', 'employer_login', 'admin_login'], range),
      countEvents(['subscription_activated', 'subscription_changed'], range),
      buildSeries(range, query.granularity),
    ]);

    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        preset: query.preset,
        inclusiveFrom: true,
        exclusiveTo: true,
        timezone: 'UTC',
      },
      granularity: query.granularity,
      lifetime: {
        totalCandidates,
        totalEmployers,
        totalCompanies,
        totalJobs,
        publishedJobs,
        totalApplications,
        activeSubscriptions,
      },
      metrics: {
        jobViews: jobViewsPeriod,
        applications: applicationsPeriod,
        interviews: interviewsPeriod,
        savedJobs: savedJobsPeriod,
        logins: loginsPeriod,
        subscriptionActivity: subscriptionActivityPeriod,
      },
      series,
    };
  }

  async listAdminEvents(query: AdminAnalyticsEventsQuery) {
    const range = resolveAnalyticsDateRange({
      preset: query.preset,
      from: query.from,
      to: query.to,
    });

    const filter: Record<string, unknown> = { ...rangeFilter(range) };
    if (query.eventType) filter.eventType = query.eventType;
    if (query.actorRole) filter.actorRole = query.actorRole;
    if (query.entityType) filter.entityType = query.entityType;
    if (query.jobId) filter.jobId = new mongoose.Types.ObjectId(query.jobId);
    if (query.employerId) filter.employerId = new mongoose.Types.ObjectId(query.employerId);
    if (query.candidateId) filter.candidateId = new mongoose.Types.ObjectId(query.candidateId);
    if (query.companyId) filter.companyId = new mongoose.Types.ObjectId(query.companyId);
    if (query.categoryId) filter.categoryId = new mongoose.Types.ObjectId(query.categoryId);
    if (query.locationId) filter.locationId = new mongoose.Types.ObjectId(query.locationId);

    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      AnalyticsEvent.countDocuments(filter),
      AnalyticsEvent.find(filter)
        .sort({ occurredAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .select('-ipHash -userAgent'),
    ]);

    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        timezone: 'UTC',
      },
      events: rows.map((row) => mapSafeEvent(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getAdminJobs(query: AdminAnalyticsPagedQuery) {
    const range = resolveAnalyticsDateRange({
      preset: query.preset,
      from: query.from,
      to: query.to,
    });

    const sortField =
      query.sort === 'applications'
        ? 'applications'
        : query.sort === 'saves'
          ? 'saves'
          : query.sort === 'interviews'
            ? 'interviews'
            : query.sort === 'conversion'
              ? 'conversionRate'
              : 'views';

    const rows = await AnalyticsEvent.aggregate([
      {
        $match: {
          ...rangeFilter(range),
          jobId: { $ne: null },
          eventType: {
            $in: ['job_view', 'application_submitted', 'job_saved', 'interview_scheduled'],
          },
        },
      },
      {
        $group: {
          _id: '$jobId',
          views: {
            $sum: { $cond: [{ $eq: ['$eventType', 'job_view'] }, 1, 0] },
          },
          applications: {
            $sum: { $cond: [{ $eq: ['$eventType', 'application_submitted'] }, 1, 0] },
          },
          saves: {
            $sum: { $cond: [{ $eq: ['$eventType', 'job_saved'] }, 1, 0] },
          },
          interviews: {
            $sum: { $cond: [{ $eq: ['$eventType', 'interview_scheduled'] }, 1, 0] },
          },
        },
      },
      {
        $addFields: {
          conversionRate: {
            $cond: [
              { $gt: ['$views', 0] },
              {
                $round: [{ $multiply: [{ $divide: ['$applications', '$views'] }, 100] }, 2],
              },
              0,
            ],
          },
        },
      },
      { $sort: { [sortField]: -1, _id: 1 } },
      {
        $facet: {
          meta: [{ $count: 'total' }],
          items: [
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
            {
              $lookup: {
                from: 'jobs',
                localField: '_id',
                foreignField: '_id',
                as: 'job',
              },
            },
            { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: 'companies',
                localField: 'job.companyId',
                foreignField: '_id',
                as: 'company',
              },
            },
            { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                jobId: { $toString: '$_id' },
                title: { $ifNull: ['$job.title', null] },
                slug: { $ifNull: ['$job.slug', null] },
                status: { $ifNull: ['$job.status', null] },
                operationalViews: { $ifNull: ['$job.views', 0] },
                operationalApplications: { $ifNull: ['$job.applicationsCount', 0] },
                company: {
                  id: { $cond: ['$company._id', { $toString: '$company._id' }, null] },
                  name: { $ifNull: ['$company.name', null] },
                  slug: { $ifNull: ['$company.slug', null] },
                },
                views: 1,
                applications: 1,
                saves: 1,
                interviews: 1,
                conversionRate: 1,
              },
            },
          ],
        },
      },
    ]);

    const total = rows[0]?.meta?.[0]?.total ?? 0;
    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        timezone: 'UTC',
      },
      jobs: rows[0]?.items ?? [],
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getAdminEmployers(query: AdminAnalyticsPagedQuery) {
    const range = resolveAnalyticsDateRange({
      preset: query.preset,
      from: query.from,
      to: query.to,
    });

    const rows = await AnalyticsEvent.aggregate([
      {
        $match: {
          ...rangeFilter(range),
          companyId: { $ne: null },
          eventType: {
            $in: [
              'job_view',
              'application_submitted',
              'interview_scheduled',
              'job_created',
              'job_published',
            ],
          },
        },
      },
      {
        $group: {
          _id: '$companyId',
          views: {
            $sum: { $cond: [{ $eq: ['$eventType', 'job_view'] }, 1, 0] },
          },
          applications: {
            $sum: { $cond: [{ $eq: ['$eventType', 'application_submitted'] }, 1, 0] },
          },
          interviews: {
            $sum: { $cond: [{ $eq: ['$eventType', 'interview_scheduled'] }, 1, 0] },
          },
          jobsCreated: {
            $sum: { $cond: [{ $eq: ['$eventType', 'job_created'] }, 1, 0] },
          },
          jobsPublished: {
            $sum: { $cond: [{ $eq: ['$eventType', 'job_published'] }, 1, 0] },
          },
        },
      },
      {
        $addFields: {
          conversionRate: {
            $cond: [
              { $gt: ['$views', 0] },
              {
                $round: [{ $multiply: [{ $divide: ['$applications', '$views'] }, 100] }, 2],
              },
              0,
            ],
          },
        },
      },
      { $sort: { applications: -1, views: -1 } },
      {
        $facet: {
          meta: [{ $count: 'total' }],
          items: [
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
            {
              $lookup: {
                from: 'companies',
                localField: '_id',
                foreignField: '_id',
                as: 'company',
              },
            },
            { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: 'subscriptions',
                let: { companyId: '$_id' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$companyId', '$$companyId'] },
                          { $in: ['$status', ['active', 'trial']] },
                        ],
                      },
                    },
                  },
                  { $sort: { endDate: -1 } },
                  { $limit: 1 },
                  { $project: { plan: 1, status: 1, endDate: 1 } },
                ],
                as: 'subscription',
              },
            },
            {
              $project: {
                _id: 0,
                companyId: { $toString: '$_id' },
                companyName: { $ifNull: ['$company.name', null] },
                companySlug: { $ifNull: ['$company.slug', null] },
                views: 1,
                applications: 1,
                interviews: 1,
                jobsCreated: 1,
                jobsPublished: 1,
                conversionRate: 1,
                activeSubscription: {
                  $cond: [
                    { $gt: [{ $size: '$subscription' }, 0] },
                    {
                      plan: { $arrayElemAt: ['$subscription.plan', 0] },
                      status: { $arrayElemAt: ['$subscription.status', 0] },
                      endDate: { $arrayElemAt: ['$subscription.endDate', 0] },
                    },
                    null,
                  ],
                },
              },
            },
          ],
        },
      },
    ]);

    const total = rows[0]?.meta?.[0]?.total ?? 0;
    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        timezone: 'UTC',
      },
      employers: rows[0]?.items ?? [],
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getAdminCandidates(query: AdminAnalyticsPagedQuery) {
    const range = resolveAnalyticsDateRange({
      preset: query.preset,
      from: query.from,
      to: query.to,
    });

    const [registrations, applications, savedJobs, interviews, activeCandidates] =
      await Promise.all([
        Candidate.countDocuments({
          createdAt: { $gte: range.from, $lt: range.to },
        }),
        countEvents(['application_submitted'], range),
        countEvents(['job_saved'], range),
        countEvents(
          ['interview_scheduled', 'interview_confirmed', 'interview_declined'],
          range,
        ),
        Candidate.countDocuments({
          updatedAt: { $gte: range.from, $lt: range.to },
        }),
      ]);

    const activity = await AnalyticsEvent.aggregate([
      {
        $match: {
          ...rangeFilter(range),
          candidateId: { $ne: null },
          eventType: {
            $in: [
              'application_submitted',
              'job_saved',
              'interview_scheduled',
              'interview_confirmed',
              'candidate_login',
            ],
          },
        },
      },
      {
        $group: {
          _id: '$candidateId',
          applications: {
            $sum: { $cond: [{ $eq: ['$eventType', 'application_submitted'] }, 1, 0] },
          },
          saves: {
            $sum: { $cond: [{ $eq: ['$eventType', 'job_saved'] }, 1, 0] },
          },
          interviews: {
            $sum: {
              $cond: [
                {
                  $in: ['$eventType', ['interview_scheduled', 'interview_confirmed']],
                },
                1,
                0,
              ],
            },
          },
          logins: {
            $sum: { $cond: [{ $eq: ['$eventType', 'candidate_login'] }, 1, 0] },
          },
        },
      },
      { $sort: { applications: -1, saves: -1 } },
      {
        $facet: {
          meta: [{ $count: 'total' }],
          items: [
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
            {
              $project: {
                _id: 0,
                candidateId: { $toString: '$_id' },
                applications: 1,
                saves: 1,
                interviews: 1,
                logins: 1,
              },
            },
          ],
        },
      },
    ]);

    const total = activity[0]?.meta?.[0]?.total ?? 0;

    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        timezone: 'UTC',
      },
      summary: {
        registrations,
        applications,
        savedJobs,
        interviews,
        activeCandidates,
      },
      candidates: activity[0]?.items ?? [],
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getAdminCategories(query: AdminAnalyticsPagedQuery) {
    const range = resolveAnalyticsDateRange({
      preset: query.preset,
      from: query.from,
      to: query.to,
    });

    const rows = await AnalyticsEvent.aggregate([
      {
        $match: {
          ...rangeFilter(range),
          categoryId: { $ne: null },
          eventType: {
            $in: [
              'job_view',
              'application_submitted',
              'interview_scheduled',
              'job_created',
              'job_published',
            ],
          },
        },
      },
      {
        $group: {
          _id: '$categoryId',
          views: {
            $sum: { $cond: [{ $eq: ['$eventType', 'job_view'] }, 1, 0] },
          },
          applications: {
            $sum: { $cond: [{ $eq: ['$eventType', 'application_submitted'] }, 1, 0] },
          },
          interviews: {
            $sum: { $cond: [{ $eq: ['$eventType', 'interview_scheduled'] }, 1, 0] },
          },
          jobsCreated: {
            $sum: { $cond: [{ $eq: ['$eventType', 'job_created'] }, 1, 0] },
          },
          jobsPublished: {
            $sum: { $cond: [{ $eq: ['$eventType', 'job_published'] }, 1, 0] },
          },
        },
      },
      { $sort: { views: -1, applications: -1 } },
      {
        $facet: {
          meta: [{ $count: 'total' }],
          items: [
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
            {
              $lookup: {
                from: 'categories',
                localField: '_id',
                foreignField: '_id',
                as: 'category',
              },
            },
            { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                categoryId: { $toString: '$_id' },
                name: { $ifNull: ['$category.name', null] },
                slug: { $ifNull: ['$category.slug', null] },
                parentId: {
                  $cond: ['$category.parentId', { $toString: '$category.parentId' }, null],
                },
                operationalJobCount: { $ifNull: ['$category.jobCount', 0] },
                views: 1,
                applications: 1,
                interviews: 1,
                jobsCreated: 1,
                jobsPublished: 1,
              },
            },
          ],
        },
      },
    ]);

    const total = rows[0]?.meta?.[0]?.total ?? 0;
    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        timezone: 'UTC',
      },
      note: 'Metrics are attributed to the job categoryId only (no parent roll-up).',
      categories: rows[0]?.items ?? [],
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getAdminLocations(query: AdminAnalyticsPagedQuery) {
    const range = resolveAnalyticsDateRange({
      preset: query.preset,
      from: query.from,
      to: query.to,
    });

    const rows = await AnalyticsEvent.aggregate([
      {
        $match: {
          ...rangeFilter(range),
          locationId: { $ne: null },
          eventType: {
            $in: ['job_view', 'application_submitted', 'interview_scheduled', 'job_published'],
          },
        },
      },
      {
        $group: {
          _id: '$locationId',
          views: {
            $sum: { $cond: [{ $eq: ['$eventType', 'job_view'] }, 1, 0] },
          },
          applications: {
            $sum: { $cond: [{ $eq: ['$eventType', 'application_submitted'] }, 1, 0] },
          },
          interviews: {
            $sum: { $cond: [{ $eq: ['$eventType', 'interview_scheduled'] }, 1, 0] },
          },
          jobsPublished: {
            $sum: { $cond: [{ $eq: ['$eventType', 'job_published'] }, 1, 0] },
          },
        },
      },
      { $sort: { views: -1, applications: -1 } },
      {
        $facet: {
          meta: [{ $count: 'total' }],
          items: [
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
            {
              $lookup: {
                from: 'locations',
                localField: '_id',
                foreignField: '_id',
                as: 'location',
              },
            },
            { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                locationId: { $toString: '$_id' },
                name: { $ifNull: ['$location.name', null] },
                slug: { $ifNull: ['$location.slug', null] },
                type: { $ifNull: ['$location.type', null] },
                parentId: {
                  $cond: ['$location.parentId', { $toString: '$location.parentId' }, null],
                },
                views: 1,
                applications: 1,
                interviews: 1,
                jobsPublished: 1,
              },
            },
          ],
        },
      },
    ]);

    const total = rows[0]?.meta?.[0]?.total ?? 0;
    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        timezone: 'UTC',
      },
      note: 'Metrics use Job.location.locationId attribution (no hierarchy roll-up).',
      locations: rows[0]?.items ?? [],
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getEmployerOverview(
    employer: AuthenticatedEmployer,
    query: AdminAnalyticsOverviewQuery,
  ) {
    const range = resolveAnalyticsDateRange({
      preset: query.preset,
      from: query.from,
      to: query.to,
    });
    const companyOid = new mongoose.Types.ObjectId(employer.companyId);

    const [
      totalJobs,
      publishedJobs,
      totalApplications,
      jobViewsPeriod,
      applicationsPeriod,
      interviewsPeriod,
      savesPeriod,
    ] = await Promise.all([
      Job.countDocuments({ companyId: companyOid, deletedAt: null }),
      Job.countDocuments({ companyId: companyOid, status: 'published', deletedAt: null }),
      Application.countDocuments({ companyId: companyOid }),
      countEvents(['job_view'], range, { companyId: companyOid }),
      countEvents(['application_submitted'], range, { companyId: companyOid }),
      countEvents(['interview_scheduled'], range, { companyId: companyOid }),
      countEvents(['job_saved'], range, { companyId: companyOid }),
    ]);

    const series = await AnalyticsEvent.aggregate([
      {
        $match: {
          ...rangeFilter(range),
          companyId: companyOid,
          eventType: {
            $in: ['job_view', 'application_submitted', 'interview_scheduled'],
          },
        },
      },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: '$occurredAt',
              unit: mongoDateTruncUnit(query.granularity),
              timezone: 'UTC',
            },
          },
          jobViews: {
            $sum: { $cond: [{ $eq: ['$eventType', 'job_view'] }, 1, 0] },
          },
          applications: {
            $sum: { $cond: [{ $eq: ['$eventType', 'application_submitted'] }, 1, 0] },
          },
          interviews: {
            $sum: { $cond: [{ $eq: ['$eventType', 'interview_scheduled'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        timezone: 'UTC',
      },
      granularity: query.granularity,
      companyId: employer.companyId,
      lifetime: {
        totalJobs,
        publishedJobs,
        totalApplications,
      },
      metrics: {
        jobViews: jobViewsPeriod,
        applications: applicationsPeriod,
        interviews: interviewsPeriod,
        savedJobs: savesPeriod,
      },
      series: series.map((row) => ({
        date: (row._id as Date).toISOString().slice(0, 10),
        jobViews: row.jobViews as number,
        applications: row.applications as number,
        interviews: row.interviews as number,
      })),
    };
  }
}

export const analyticsService = new AnalyticsService();
