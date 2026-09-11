import { AnalyticsEvent } from '../../models/AnalyticsEvent';
import type { AnalyticsActorRole, AnalyticsEntityType, AnalyticsEventType } from '../../constants/enums';
import { SEED_COUNTS, SEED_META_FLAG } from '../config';
import { analyticsOccurredAt } from '../helpers/dates';
import { createSeededRng, pick } from '../helpers/rng';
import type { SeedContext } from '../types';

interface EventSpec {
  eventType: AnalyticsEventType;
  actorRole: AnalyticsActorRole;
  entityType?: AnalyticsEntityType;
}

const EVENT_SPECS: EventSpec[] = [
  { eventType: 'job_view', actorRole: 'candidate', entityType: 'job' },
  { eventType: 'job_view', actorRole: 'anonymous', entityType: 'job' },
  { eventType: 'job_view', actorRole: 'candidate', entityType: 'job' },
  { eventType: 'job_search', actorRole: 'candidate' },
  { eventType: 'job_saved', actorRole: 'candidate', entityType: 'job' },
  { eventType: 'application_submitted', actorRole: 'candidate', entityType: 'application' },
  { eventType: 'application_status_changed', actorRole: 'employer', entityType: 'application' },
  { eventType: 'interview_scheduled', actorRole: 'employer', entityType: 'interview' },
  { eventType: 'company_view', actorRole: 'candidate', entityType: 'company' },
  { eventType: 'career_article_view', actorRole: 'anonymous', entityType: 'article' },
  { eventType: 'profile_view', actorRole: 'employer', entityType: 'candidate' },
  { eventType: 'job_created', actorRole: 'employer', entityType: 'job' },
  { eventType: 'job_published', actorRole: 'employer', entityType: 'job' },
  { eventType: 'candidate_login', actorRole: 'candidate' },
  { eventType: 'employer_login', actorRole: 'employer' },
  { eventType: 'subscription_activated', actorRole: 'employer', entityType: 'subscription' },
  { eventType: 'report_created', actorRole: 'candidate', entityType: 'report' },
];

export async function seedAnalytics(ctx: SeedContext): Promise<void> {
  const rng = createSeededRng(141);
  const target = SEED_COUNTS.analyticsEvents;

  await AnalyticsEvent.deleteMany({ 'metadata.seedMode': SEED_META_FLAG });

  // Bias views toward popular published jobs (first 10 by slug sort)
  const popularJobs = [...ctx.publishedJobs].sort((a, b) => a.slug.localeCompare(b.slug)).slice(0, 10);
  const popularCategories = ctx.subcategories.slice(0, 8);

  const docs = [];
  for (let i = 0; i < target; i += 1) {
    const spec = EVENT_SPECS[i % EVENT_SPECS.length]!;
    const usePopular = popularJobs.length > 0 && rng() < 0.55;
    const job = usePopular
      ? popularJobs[i % popularJobs.length]!
      : ctx.jobs[i % ctx.jobs.length]!;
    const employer = ctx.employers.find((e) => e.employerId.equals(job.employerId))
      ?? ctx.employers[i % ctx.employers.length]!;
    const candidate = ctx.candidates[i % ctx.candidates.length]!;
    const app = ctx.applications[i % Math.max(ctx.applications.length, 1)];
    const category =
      (popularCategories.length > 0 && rng() < 0.5
        ? popularCategories[i % popularCategories.length]
        : ctx.categories[i % ctx.categories.length])!;
    const city = ctx.cities[i % ctx.cities.length]!;

    let userId = candidate.userId;
    if (spec.actorRole === 'employer') userId = employer.userId;
    if (spec.actorRole === 'admin') userId = ctx.admins[0]?.userId ?? candidate.userId;

    docs.push({
      userId: spec.actorRole === 'anonymous' ? undefined : userId,
      actorRole: spec.actorRole,
      eventType: spec.eventType,
      entityType: spec.entityType,
      entityId:
        spec.entityType === 'job'
          ? job.jobId
          : spec.entityType === 'company'
            ? employer.companyId
            : spec.entityType === 'application'
              ? app?.applicationId
              : spec.entityType === 'candidate'
                ? candidate.candidateId
                : undefined,
      jobId: job.jobId,
      companyId: employer.companyId,
      employerId: employer.employerId,
      candidateId: candidate.candidateId,
      categoryId: category.id,
      locationId: city.id,
      metadata: {
        seedMode: SEED_META_FLAG,
        seedKey: `demo-analytics-${i + 1}`,
        source: pick(rng, ['web', 'mobile', 'admin']),
      },
      sessionId: `demo-session-${(i % 80) + 1}`,
      ipHash: '',
      userAgent: 'WorkIndiaDemoSeeder/1.0',
      occurredAt: analyticsOccurredAt(rng, 90),
    });
  }

  const chunkSize = 100;
  for (let i = 0; i < docs.length; i += chunkSize) {
    await AnalyticsEvent.insertMany(docs.slice(i, i + chunkSize), { ordered: false });
  }

  ctx.summary.analyticsEvents = docs.length;
}
