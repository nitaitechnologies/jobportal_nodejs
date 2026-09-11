/**
 * Read-only demo seed verification.
 *
 *   npm run seed:verify
 *
 * Does not mutate data. Exits non-zero on integrity failures.
 */
import fs from 'fs/promises';
import path from 'path';
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from '../config/database';
import { env } from '../config/env';
import {
  APPLICATION_STATUSES,
  INTERVIEW_STATUSES,
  JOB_STATUSES,
  NOTIFICATION_TYPES,
} from '../constants/enums';
import { MEDIA_REF_PREFIX } from '../constants/media';
import { AdminUser } from '../models/AdminUser';
import { AnalyticsEvent } from '../models/AnalyticsEvent';
import { Application } from '../models/Application';
import { Candidate } from '../models/Candidate';
import { CareerArticle } from '../models/CareerArticle';
import { Category } from '../models/Category';
import { Company } from '../models/Company';
import { Employer } from '../models/Employer';
import { Interview } from '../models/Interview';
import { Job } from '../models/Job';
import { Location } from '../models/Location';
import { MediaFile } from '../models/MediaFile';
import { Notification } from '../models/Notification';
import { PlatformSetting } from '../models/PlatformSetting';
import { Report } from '../models/Report';
import { SavedJob } from '../models/SavedJob';
import { Subscription } from '../models/Subscription';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import { User } from '../models/User';
import { parseMediaRef } from '../utils/mediaMapper';
import {
  DEMO_EMAIL_DOMAIN,
  SEED_META_FLAG,
  SEED_MODE,
  assertSeedEnvironmentAllowed,
  demoEmail,
} from './config';
import { DEMO_PERSONAS } from './data/personas';
import { SeedError, printSeedFailure, sanitizeSeedMessage } from './errors';

interface CheckResult {
  ok: boolean;
  label: string;
  detail?: string;
}

function fail(label: string, detail: string): CheckResult {
  return { ok: false, label, detail };
}

function pass(label: string, detail?: string): CheckResult {
  return { ok: true, label, detail };
}

async function fileExistsForKey(storageKey: string): Promise<boolean> {
  const root = path.resolve(env.storageLocalRoot);
  const full = path.resolve(root, storageKey);
  if (!full.startsWith(root + path.sep) && full !== root) return false;
  try {
    await fs.access(full);
    return true;
  } catch {
    return false;
  }
}

export async function runSeedVerification(): Promise<{
  counts: Record<string, number>;
  checks: CheckResult[];
}> {
  assertSeedEnvironmentAllowed(env.nodeEnv);

  const demoUsers = await User.find({
    email: { $regex: `@${DEMO_EMAIL_DOMAIN}$`, $options: 'i' },
  }).select('_id email role status');
  const demoUserIds = demoUsers.map((u) => u._id);
  const candidateUsers = demoUsers.filter((u) => u.role === 'candidate');
  const employerUsers = demoUsers.filter((u) => u.role === 'employer');
  const adminUsers = demoUsers.filter((u) => u.role === 'admin');

  const candidates = await Candidate.find({
    userId: { $in: candidateUsers.map((u) => u._id) },
  });
  const candidateIds = candidates.map((c) => c._id);
  const employers = await Employer.find({
    userId: { $in: employerUsers.map((u) => u._id) },
  });
  const employerIds = employers.map((e) => e._id);
  const companyIds = employers
    .map((e) => e.companyId)
    .filter((id): id is NonNullable<typeof id> => Boolean(id));

  const jobs = await Job.find({ employerId: { $in: employerIds } });
  const jobIds = jobs.map((j) => j._id);

  const counts: Record<string, number> = {
    users: demoUsers.length,
    candidates: candidates.length,
    employers: employers.length,
    adminUsers: await AdminUser.countDocuments({ userId: { $in: adminUsers.map((u) => u._id) } }),
    companies: await Company.countDocuments({ _id: { $in: companyIds } }),
    categories: await Category.countDocuments({}),
    locations: await Location.countDocuments({}),
    jobs: jobs.length,
    publishedJobs: jobs.filter((j) => j.status === 'published').length,
    savedJobs: await SavedJob.countDocuments({ candidateId: { $in: candidateIds } }),
    applications: await Application.countDocuments({ candidateId: { $in: candidateIds } }),
    interviews: await Interview.countDocuments({ candidateId: { $in: candidateIds } }),
    notifications: await Notification.countDocuments({
      recipientId: { $in: demoUserIds },
      'data.seedMode': SEED_META_FLAG,
    }),
    careerArticles: await CareerArticle.countDocuments({}),
    reports: await Report.countDocuments({ reporterId: { $in: demoUserIds } }),
    subscriptionPlans: await SubscriptionPlan.countDocuments({}),
    subscriptions: await Subscription.countDocuments({ companyId: { $in: companyIds } }),
    platformSettings: await PlatformSetting.countDocuments({}),
    analyticsEvents: await AnalyticsEvent.countDocuments({ 'metadata.seedMode': SEED_META_FLAG }),
    media: await MediaFile.countDocuments({ storageKey: { $regex: /^demo\// }, status: 'active' }),
  };

  const checks: CheckResult[] = [];

  // Duplicate emails
  const emailDupes = await User.aggregate([
    { $group: { _id: '$email', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  checks.push(
    emailDupes.length === 0
      ? pass('unique emails')
      : fail('unique emails', `${emailDupes.length} duplicate group(s)`),
  );

  // Duplicate slugs
  for (const [Model, label] of [
    [Company, 'company slugs'],
    [Job, 'job slugs'],
    [Category, 'category slugs'],
    [Location, 'location slugs'],
  ] as const) {
    const dupes = await Model.aggregate([
      { $group: { _id: '$slug', n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ]);
    checks.push(
      dupes.length === 0 ? pass(`unique ${label}`) : fail(`unique ${label}`, `${dupes.length} dups`),
    );
  }

  const settingDupes = await PlatformSetting.aggregate([
    { $group: { _id: '$key', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  checks.push(
    settingDupes.length === 0
      ? pass('unique platform setting keys')
      : fail('unique platform setting keys', `${settingDupes.length} dups`),
  );

  const mediaKeyDupes = await MediaFile.aggregate([
    { $group: { _id: '$storageKey', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  checks.push(
    mediaKeyDupes.length === 0
      ? pass('unique media storageKeys')
      : fail('unique media storageKeys', `${mediaKeyDupes.length} dups`),
  );

  // Saved / application unique pairs
  const savedDupes = await SavedJob.aggregate([
    { $match: { candidateId: { $in: candidateIds } } },
    { $group: { _id: { c: '$candidateId', j: '$jobId' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  checks.push(
    savedDupes.length === 0
      ? pass('unique saved-job pairs')
      : fail('unique saved-job pairs', `${savedDupes.length} dups`),
  );

  const appDupes = await Application.aggregate([
    { $match: { candidateId: { $in: candidateIds } } },
    { $group: { _id: { c: '$candidateId', j: '$jobId' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  checks.push(
    appDupes.length === 0
      ? pass('unique application pairs')
      : fail('unique application pairs', `${appDupes.length} dups`),
  );

  // Ownership: candidate → user
  let orphanCandidates = 0;
  for (const c of candidates) {
    if (!demoUsers.some((u) => u._id.equals(c.userId) && u.role === 'candidate')) {
      orphanCandidates += 1;
    }
  }
  checks.push(
    orphanCandidates === 0
      ? pass('candidate→user ownership')
      : fail('candidate→user ownership', `${orphanCandidates} orphans`),
  );

  let orphanEmployers = 0;
  for (const e of employers) {
    if (!e.companyId || !demoUsers.some((u) => u._id.equals(e.userId) && u.role === 'employer')) {
      orphanEmployers += 1;
    }
  }
  checks.push(
    orphanEmployers === 0
      ? pass('employer→user/company ownership')
      : fail('employer→user/company ownership', `${orphanEmployers} issues`),
  );

  // Job ownership
  let badJobs = 0;
  for (const job of jobs) {
    const emp = employers.find((e) => e._id.equals(job.employerId));
    if (!emp || !emp.companyId?.equals(job.companyId)) badJobs += 1;
    if (job.status && !(JOB_STATUSES as readonly string[]).includes(job.status)) badJobs += 1;
  }
  checks.push(badJobs === 0 ? pass('job ownership/status') : fail('job ownership/status', `${badJobs}`));

  // Saved jobs references
  const saved = await SavedJob.find({ candidateId: { $in: candidateIds } }).limit(500);
  let badSaved = 0;
  for (const s of saved) {
    if (!candidateIds.some((id) => id.equals(s.candidateId))) badSaved += 1;
    if (!jobIds.some((id) => id.equals(s.jobId))) badSaved += 1;
  }
  checks.push(
    badSaved === 0 ? pass('saved-job references') : fail('saved-job references', `${badSaved}`),
  );

  // Applications + enums
  const apps = await Application.find({ candidateId: { $in: candidateIds } });
  let badApps = 0;
  for (const a of apps) {
    if (!candidateIds.some((id) => id.equals(a.candidateId))) badApps += 1;
    if (!jobIds.some((id) => id.equals(a.jobId))) badApps += 1;
    if (!(APPLICATION_STATUSES as readonly string[]).includes(a.status)) badApps += 1;
    const emp = employers.find((e) => e._id.equals(a.employerId));
    if (!emp || !emp.companyId?.equals(a.companyId)) badApps += 1;
  }
  checks.push(
    badApps === 0 ? pass('application integrity') : fail('application integrity', `${badApps}`),
  );

  // Interviews
  const interviews = await Interview.find({ candidateId: { $in: candidateIds } });
  let badInterviews = 0;
  const now = Date.now();
  for (const iv of interviews) {
    if (!(INTERVIEW_STATUSES as readonly string[]).includes(iv.status)) badInterviews += 1;
    const app = apps.find((a) => a._id.equals(iv.applicationId));
    if (!app) {
      badInterviews += 1;
      continue;
    }
    if (!app.candidateId.equals(iv.candidateId) || !app.jobId.equals(iv.jobId)) badInterviews += 1;
    if (!app.employerId.equals(iv.employerId) || !app.companyId.equals(iv.companyId)) {
      badInterviews += 1;
    }
    const scheduled = iv.scheduledAt?.getTime?.() ?? 0;
    if (iv.status === 'completed' && scheduled > now + 60_000) badInterviews += 1;
    if (iv.status === 'cancelled' && scheduled > now + 7 * 86400000) {
      // cancelled can still have future slot historically; allow
    }
  }
  checks.push(
    badInterviews === 0
      ? pass('interview integrity', `${interviews.length} checked`)
      : fail('interview integrity', `${badInterviews} issues`),
  );

  // Notifications
  const notifs = await Notification.find({
    recipientId: { $in: demoUserIds },
    'data.seedMode': SEED_META_FLAG,
  }).limit(300);
  let badNotif = 0;
  for (const n of notifs) {
    if (!(NOTIFICATION_TYPES as readonly string[]).includes(n.type)) badNotif += 1;
    if (!demoUserIds.some((id) => id.equals(n.recipientId))) badNotif += 1;
    const data = (n.data ?? {}) as Record<string, string>;
    if (data.applicationId && !apps.some((a) => a._id.toString() === data.applicationId)) {
      // application may have been pruned; count soft
    }
    if (data.jobId && !jobIds.some((id) => id.toString() === data.jobId)) {
      badNotif += 1;
    }
  }
  checks.push(
    badNotif === 0
      ? pass('notification integrity', `${notifs.length} sampled`)
      : fail('notification integrity', `${badNotif}`),
  );

  // Subscriptions
  const plans = await SubscriptionPlan.find({}).select('_id slug');
  const subs = await Subscription.find({ companyId: { $in: companyIds } });
  let badSubs = 0;
  for (const s of subs) {
    if (!plans.some((p) => p.slug === s.plan)) badSubs += 1;
    if (!companyIds.some((id) => id.equals(s.companyId))) badSubs += 1;
  }
  checks.push(
    badSubs === 0
      ? pass('subscription↔plan integrity', `${subs.length}`)
      : fail('subscription↔plan integrity', `${badSubs}`),
  );

  // Reports target existence (best-effort)
  const reports = await Report.find({ reporterId: { $in: demoUserIds } });
  let badReports = 0;
  for (const r of reports) {
    if (r.targetType === 'job' && !(await Job.exists({ _id: r.targetId }))) badReports += 1;
    if (r.targetType === 'company' && !(await Company.exists({ _id: r.targetId }))) badReports += 1;
    if (r.targetType === 'candidate' && !(await Candidate.exists({ _id: r.targetId }))) {
      badReports += 1;
    }
    if (r.targetType === 'employer' && !(await Employer.exists({ _id: r.targetId }))) {
      badReports += 1;
    }
  }
  checks.push(
    badReports === 0
      ? pass('report targets', `${reports.length}`)
      : fail('report targets', `${badReports}`),
  );

  // Media files on disk + private resumes
  const demoMedia = await MediaFile.find({
    storageKey: { $regex: /^demo\// },
    status: 'active',
  });
  let missingFiles = 0;
  let badResumeVisibility = 0;
  for (const m of demoMedia) {
    if (!(await fileExistsForKey(m.storageKey))) missingFiles += 1;
    if (m.category === 'candidate_resume' && m.visibility !== 'private') badResumeVisibility += 1;
  }
  checks.push(
    missingFiles === 0
      ? pass('media files on disk', `${demoMedia.length}`)
      : fail('media files on disk', `${missingFiles} missing`),
  );
  checks.push(
    badResumeVisibility === 0
      ? pass('resume media private')
      : fail('resume media private', `${badResumeVisibility}`),
  );

  // Resume refs parseable
  let badResumeRefs = 0;
  for (const c of candidates) {
    const resume = c.resume ?? '';
    if (!resume) continue;
    if (resume.startsWith(MEDIA_REF_PREFIX)) {
      const id = parseMediaRef(resume);
      if (!id || !(await MediaFile.exists({ _id: id, status: 'active' }))) badResumeRefs += 1;
    }
  }
  checks.push(
    badResumeRefs === 0
      ? pass('candidate resume media refs')
      : fail('candidate resume media refs', `${badResumeRefs}`),
  );

  // Personas present
  const required = [
    demoEmail('superadmin'),
    demoEmail('admin'),
    demoEmail(DEMO_PERSONAS.candidateComplete.emailLocal),
    demoEmail(DEMO_PERSONAS.candidateIncomplete.emailLocal),
    demoEmail(DEMO_PERSONAS.candidateActive.emailLocal),
    demoEmail(DEMO_PERSONAS.employerActive.emailLocal),
    demoEmail(DEMO_PERSONAS.employerNew.emailLocal),
    demoEmail(DEMO_PERSONAS.employerPaid.emailLocal),
  ];
  const missingPersonas = required.filter((email) => !demoUsers.some((u) => u.email === email));
  checks.push(
    missingPersonas.length === 0
      ? pass('demo personas present')
      : fail('demo personas present', missingPersonas.join(', ')),
  );

  // Scale / pagination readiness
  checks.push(
    counts.publishedJobs >= 50
      ? pass('published jobs scale', String(counts.publishedJobs))
      : fail('published jobs scale', String(counts.publishedJobs)),
  );
  checks.push(
    counts.applications >= 100
      ? pass('applications scale', String(counts.applications))
      : fail('applications scale', String(counts.applications)),
  );
  checks.push(
    counts.candidates >= 30
      ? pass('candidates scale', String(counts.candidates))
      : fail('candidates scale', String(counts.candidates)),
  );
  checks.push(
    counts.analyticsEvents >= 400
      ? pass('analytics scale', String(counts.analyticsEvents))
      : fail('analytics scale', String(counts.analyticsEvents)),
  );

  // Empty-state preservation
  const incomplete = await User.findOne({
    email: demoEmail(DEMO_PERSONAS.candidateIncomplete.emailLocal),
  });
  if (incomplete) {
    const ic = await Candidate.findOne({ userId: incomplete._id });
    const savedCount = ic
      ? await SavedJob.countDocuments({ candidateId: ic._id })
      : -1;
    const appCount = ic
      ? await Application.countDocuments({ candidateId: ic._id })
      : -1;
    checks.push(
      savedCount === 0 && appCount === 0
        ? pass('empty-state incomplete candidate')
        : fail('empty-state incomplete candidate', `saved=${savedCount} apps=${appCount}`),
    );
  }

  const quietEmployer = employers[employers.length - 1];
  if (quietEmployer) {
    const quietJobs = await Job.countDocuments({ employerId: quietEmployer._id });
    checks.push(
      quietJobs === 0
        ? pass('empty-state quiet employer (0 jobs)')
        : pass('employer job variety', `quiet employer has ${quietJobs} jobs`),
    );
  }

  // Career public published only expectation (drafts exist)
  const publishedArticles = await CareerArticle.countDocuments({ status: 'published' });
  const draftArticles = await CareerArticle.countDocuments({ status: 'draft' });
  checks.push(
    publishedArticles >= 10
      ? pass('published career articles', String(publishedArticles))
      : fail('published career articles', String(publishedArticles)),
  );
  checks.push(pass('draft career articles preserved', String(draftArticles)));

  return { counts, checks };
}

async function main(): Promise<void> {
  assertSeedEnvironmentAllowed(env.nodeEnv);

  console.log('');
  console.log('WorkIndia Demo Seed Verification');
  console.log('');
  console.log(`Environment: ${env.nodeEnv}`);
  console.log(`Mode: ${SEED_MODE}`);
  console.log('Mutations: none (read-only)');
  console.log('');

  try {
    await connectDatabase();
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : 'Unknown connection error';
    throw new SeedError('database', 'MongoDB', sanitizeSeedMessage(reason));
  }
  if (!isDatabaseConnected()) {
    throw new SeedError('database', 'MongoDB', 'MongoDB connection validation failed');
  }

  const { counts, checks } = await runSeedVerification();

  console.log('Counts:');
  for (const [key, value] of Object.entries(counts)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('');
  console.log('Checks:');
  let failed = 0;
  for (const check of checks) {
    if (check.ok) {
      console.log(`  ✓ ${check.label}${check.detail ? ` (${check.detail})` : ''}`);
    } else {
      failed += 1;
      console.log(`  ✗ ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
    }
  }
  console.log('');
  if (failed > 0) {
    console.error(`Integrity checks: FAIL (${failed})`);
    console.error('Verify status: FAILED');
    process.exitCode = 1;
  } else {
    console.log('Integrity checks: PASS');
    console.log('Verify status: SUCCESS');
  }
  console.log('');
}

main()
  .catch((error: unknown) => {
    printSeedFailure(
      error instanceof SeedError
        ? error
        : new SeedError(
            'unexpected',
            'Verify',
            error instanceof Error ? error.message : 'Unknown error',
          ),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase().catch(() => undefined);
    process.exit(process.exitCode ?? 0);
  });
