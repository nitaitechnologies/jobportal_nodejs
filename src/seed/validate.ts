import {
  APPLICATION_STATUSES,
  INTERVIEW_STATUSES,
  JOB_STATUSES,
  NOTIFICATION_TYPES,
} from '../constants/enums';
import { Application } from '../models/Application';
import { Candidate } from '../models/Candidate';
import { Category } from '../models/Category';
import { Company } from '../models/Company';
import { Employer } from '../models/Employer';
import { Interview } from '../models/Interview';
import { Job } from '../models/Job';
import { Location } from '../models/Location';
import { Notification } from '../models/Notification';
import { SavedJob } from '../models/SavedJob';
import { Subscription } from '../models/Subscription';
import { User } from '../models/User';
import { DEMO_EMAIL_DOMAIN, demoEmail } from './config';
import { allCategorySlugs } from './data/categories';
import { allCompanySlugs } from './data/companies';
import { allLocationSlugs } from './data/locations';
import { DEMO_PERSONAS } from './data/personas';
import type { SeedContext } from './types';

export class SeedValidationError extends Error {
  constructor(
    message: string,
    readonly domain: string,
  ) {
    super(`[${domain}] ${message}`);
    this.name = 'SeedValidationError';
  }
}

export interface IntegrityReport {
  ok: boolean;
  checks: string[];
  failures: string[];
}

async function assertUnique(
  domain: string,
  duplicates: unknown[],
  label: string,
): Promise<void> {
  if (duplicates.length > 0) {
    throw new SeedValidationError(`${label}: ${duplicates.length} duplicate group(s)`, domain);
  }
}

export async function validateSeed(ctx: SeedContext): Promise<IntegrityReport> {
  const checks: string[] = [];
  const failures: string[] = [];

  const fail = (domain: string, message: string) => {
    failures.push(`[${domain}] ${message}`);
  };

  try {
    const demoUsers = await User.countDocuments({
      email: { $regex: `@${DEMO_EMAIL_DOMAIN}$`, $options: 'i' },
    });
    if (demoUsers < ctx.summary.admins + ctx.summary.candidates + ctx.summary.employers) {
      fail('users', 'Demo user count lower than expected');
    } else {
      checks.push(`demo users present (${demoUsers})`);
    }

    const emailDupes = await User.aggregate([
      { $group: { _id: '$email', n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ]);
    await assertUnique('users', emailDupes, 'Duplicate emails');
    checks.push('no duplicate emails');

    const categoryCount = await Category.countDocuments({ slug: { $in: allCategorySlugs() } });
    if (categoryCount !== ctx.summary.categories) {
      fail('categories', `Expected ${ctx.summary.categories}, found ${categoryCount}`);
    } else {
      checks.push(`categories ok (${categoryCount})`);
    }

    const catDupes = await Category.aggregate([
      { $group: { _id: '$slug', n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ]);
    await assertUnique('categories', catDupes, 'Duplicate category slugs');
    checks.push('no duplicate category slugs');

    for (const child of ctx.subcategories) {
      if (!child.parentId) fail('categories', `Subcategory ${child.slug} missing parent`);
    }
    checks.push('category parent/child hierarchy');

    const locationCount = await Location.countDocuments({ slug: { $in: allLocationSlugs() } });
    if (locationCount !== ctx.summary.locations) {
      fail('locations', `Expected ${ctx.summary.locations}, found ${locationCount}`);
    } else {
      checks.push(`locations ok (${locationCount})`);
    }

    const locDupes = await Location.aggregate([
      { $group: { _id: '$slug', n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ]);
    await assertUnique('locations', locDupes, 'Duplicate location slugs');
    checks.push('no duplicate location slugs');

    const companyCount = await Company.countDocuments({ slug: { $in: allCompanySlugs() } });
    if (companyCount !== ctx.summary.companies) {
      fail('companies', `Expected ${ctx.summary.companies}, found ${companyCount}`);
    } else {
      checks.push(`companies ok (${companyCount})`);
    }

    const companyDupes = await Company.aggregate([
      { $group: { _id: '$slug', n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ]);
    await assertUnique('companies', companyDupes, 'Duplicate company slugs');
    checks.push('no duplicate company slugs');

    const employersMissingCompany = await Employer.countDocuments({
      userId: { $in: ctx.employers.map((e) => e.userId) },
      $or: [{ companyId: { $exists: false } }, { companyId: null }],
    });
    if (employersMissingCompany > 0) fail('employers', 'Employers missing companyId');
    else checks.push('employer→company ownership');

    for (const c of ctx.candidates.slice(0, 8)) {
      const found = await Candidate.findOne({ userId: c.userId });
      if (!found) fail('candidates', `Missing candidate for ${c.email}`);
    }
    checks.push('candidate profiles linked');

    const jobDupes = await Job.aggregate([
      { $match: { employerId: { $in: ctx.employers.map((e) => e.employerId) } } },
      { $group: { _id: '$slug', n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ]);
    await assertUnique('jobs', jobDupes, 'Duplicate job slugs');
    checks.push('no duplicate job slugs');

    const invalidJobStatus = await Job.countDocuments({
      employerId: { $in: ctx.employers.map((e) => e.employerId) },
      status: { $nin: [...JOB_STATUSES] },
    });
    if (invalidJobStatus > 0) fail('jobs', 'Invalid job status enum values');
    else checks.push('job statuses valid');

    for (const job of ctx.jobs) {
      const employer = ctx.employers.find((e) => e.employerId.equals(job.employerId));
      if (!employer || !employer.companyId.equals(job.companyId)) {
        fail('jobs', `Ownership mismatch for ${job.slug}`);
      }
    }
    checks.push('job ownership');

    const savedDupes = await SavedJob.aggregate([
      { $match: { candidateId: { $in: ctx.candidates.map((c) => c.candidateId) } } },
      { $group: { _id: { c: '$candidateId', j: '$jobId' }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ]);
    await assertUnique('savedJobs', savedDupes, 'Duplicate saved pairs');
    checks.push('no duplicate saved jobs');

    const appDupes = await Application.aggregate([
      { $match: { candidateId: { $in: ctx.candidates.map((c) => c.candidateId) } } },
      { $group: { _id: { c: '$candidateId', j: '$jobId' }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ]);
    await assertUnique('applications', appDupes, 'Duplicate applications');
    checks.push('no duplicate applications');

    const invalidAppStatus = await Application.countDocuments({
      candidateId: { $in: ctx.candidates.map((c) => c.candidateId) },
      status: { $nin: [...APPLICATION_STATUSES] },
    });
    if (invalidAppStatus > 0) fail('applications', 'Invalid application status');
    else checks.push('application statuses valid');

    const interviews = await Interview.find({
      candidateId: { $in: ctx.candidates.map((c) => c.candidateId) },
    });
    for (const interview of interviews) {
      if (![...INTERVIEW_STATUSES].includes(interview.status as (typeof INTERVIEW_STATUSES)[number])) {
        fail('interviews', `Invalid status ${interview.status}`);
      }
      const app = await Application.findById(interview.applicationId);
      if (!app) {
        fail('interviews', 'Interview missing application');
        continue;
      }
      if (!app.candidateId.equals(interview.candidateId) || !app.jobId.equals(interview.jobId)) {
        fail('interviews', 'Interview/application ownership mismatch');
      }
    }
    checks.push(`interviews linked (${interviews.length})`);

    const invalidNotif = await Notification.countDocuments({
      recipientId: { $in: [...ctx.candidates, ...ctx.employers].map((u) => u.userId) },
      type: { $nin: [...NOTIFICATION_TYPES] },
    });
    if (invalidNotif > 0) fail('notifications', 'Invalid notification types');
    else checks.push('notification types valid');

    const subs = await Subscription.find({
      companyId: { $in: ctx.employers.map((e) => e.companyId) },
    });
    for (const sub of subs) {
      if (!ctx.plans.some((p) => p.slug === sub.plan)) {
        fail('subscriptions', `Unknown plan slug ${sub.plan}`);
      }
    }
    checks.push(`subscriptions↔plans (${subs.length})`);

    // Required demo personas
    const requiredEmails = [
      demoEmail('superadmin'),
      demoEmail(DEMO_PERSONAS.candidateComplete.emailLocal),
      demoEmail(DEMO_PERSONAS.candidateIncomplete.emailLocal),
      demoEmail(DEMO_PERSONAS.candidateActive.emailLocal),
      demoEmail(DEMO_PERSONAS.employerActive.emailLocal),
      demoEmail(DEMO_PERSONAS.employerNew.emailLocal),
      demoEmail(DEMO_PERSONAS.employerPaid.emailLocal),
    ];
    for (const email of requiredEmails) {
      const u = await User.findOne({ email });
      if (!u) fail('personas', `Missing persona account ${email}`);
    }
    checks.push('demo personas present');

    const published = ctx.publishedJobs.length;
    if (published < 50) fail('jobs', `Too few published jobs (${published})`);
    else checks.push(`published jobs (${published})`);
  } catch (error) {
    if (error instanceof SeedValidationError) {
      failures.push(error.message);
    } else {
      throw error;
    }
  }

  if (failures.length > 0) {
    throw new SeedValidationError(failures.join('; '), 'integrity');
  }

  return { ok: true, checks, failures };
}

export function printIntegrityReport(report: IntegrityReport): void {
  console.log('');
  console.log('Seed Integrity Report');
  for (const check of report.checks) {
    console.log(`  ✓ ${check}`);
  }
  if (report.failures.length > 0) {
    for (const failure of report.failures) {
      console.log(`  ✗ ${failure}`);
    }
  }
  console.log('');
}
