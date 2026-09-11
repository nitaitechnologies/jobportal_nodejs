/**
 * Safe demo-data reset — removes only identifiable seed/demo documents.
 * Never wipe arbitrary collections. Requires env allowlist + SEED_ALLOW_RESET=1.
 */
import { AnalyticsEvent } from '../models/AnalyticsEvent';
import { Application } from '../models/Application';
import { AdminUser } from '../models/AdminUser';
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
import { Report } from '../models/Report';
import { SavedJob } from '../models/SavedJob';
import { Subscription } from '../models/Subscription';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import { User } from '../models/User';
import { DEMO_EMAIL_DOMAIN, SEED_META_FLAG, assertSeedEnvironmentAllowed } from './config';
import { allArticleSlugs } from './data/articles';
import { allCategorySlugs } from './data/categories';
import { allCompanySlugs } from './data/companies';
import { allLocationSlugs } from './data/locations';
import { allPlanSlugs } from './data/plans';
import { env } from '../config/env';

export interface ResetCounts {
  [key: string]: number;
}

export async function resetDemoData(): Promise<ResetCounts> {
  assertSeedEnvironmentAllowed(env.nodeEnv, { destructive: true });

  const demoUsers = await User.find({
    email: { $regex: `@${DEMO_EMAIL_DOMAIN}$`, $options: 'i' },
  }).select('_id role');

  const userIds = demoUsers.map((u) => u._id);
  const candidateUserIds = demoUsers.filter((u) => u.role === 'candidate').map((u) => u._id);
  const employerUserIds = demoUsers.filter((u) => u.role === 'employer').map((u) => u._id);
  const adminUserIds = demoUsers.filter((u) => u.role === 'admin').map((u) => u._id);

  const candidates = await Candidate.find({ userId: { $in: candidateUserIds } }).select('_id');
  const candidateIds = candidates.map((c) => c._id);

  const employers = await Employer.find({ userId: { $in: employerUserIds } }).select(
    '_id companyId',
  );
  const employerIds = employers.map((e) => e._id);
  const companyIds = employers
    .map((e) => e.companyId)
    .filter((id): id is NonNullable<typeof id> => Boolean(id));

  // Also include companies by known demo slugs
  const companiesBySlug = await Company.find({ slug: { $in: allCompanySlugs() } }).select('_id');
  for (const c of companiesBySlug) {
    if (!companyIds.some((id) => id.equals(c._id))) {
      companyIds.push(c._id);
    }
  }

  const jobs = await Job.find({
    $or: [{ companyId: { $in: companyIds } }, { employerId: { $in: employerIds } }],
  }).select('_id');
  const jobIds = jobs.map((j) => j._id);

  const counts: ResetCounts = {};

  counts.analyticsEvents = (
    await AnalyticsEvent.deleteMany({ 'metadata.seedMode': SEED_META_FLAG })
  ).deletedCount;
  counts.notifications = (
    await Notification.deleteMany({
      $or: [{ recipientId: { $in: userIds } }, { 'data.seedMode': SEED_META_FLAG }],
    })
  ).deletedCount;
  counts.reports = (await Report.deleteMany({ reporterId: { $in: userIds } })).deletedCount;
  counts.interviews = (
    await Interview.deleteMany({
      $or: [
        { candidateId: { $in: candidateIds } },
        { employerId: { $in: employerIds } },
        { companyId: { $in: companyIds } },
      ],
    })
  ).deletedCount;
  counts.applications = (
    await Application.deleteMany({
      $or: [
        { candidateId: { $in: candidateIds } },
        { employerId: { $in: employerIds } },
        { companyId: { $in: companyIds } },
      ],
    })
  ).deletedCount;
  counts.savedJobs = (
    await SavedJob.deleteMany({
      $or: [{ candidateId: { $in: candidateIds } }, { jobId: { $in: jobIds } }],
    })
  ).deletedCount;
  counts.jobs = (await Job.deleteMany({ _id: { $in: jobIds } })).deletedCount;
  counts.subscriptions = (
    await Subscription.deleteMany({
      $or: [{ userId: { $in: employerUserIds } }, { companyId: { $in: companyIds } }],
    })
  ).deletedCount;
  counts.mediaFiles = (
    await MediaFile.deleteMany({
      $or: [{ ownerUserId: { $in: userIds } }, { storageKey: { $regex: /^demo\// } }],
    })
  ).deletedCount;
  counts.candidates = (await Candidate.deleteMany({ _id: { $in: candidateIds } })).deletedCount;
  counts.employers = (await Employer.deleteMany({ _id: { $in: employerIds } })).deletedCount;
  counts.companies = (await Company.deleteMany({ _id: { $in: companyIds } })).deletedCount;
  counts.adminUsers = (await AdminUser.deleteMany({ userId: { $in: adminUserIds } })).deletedCount;
  counts.users = (await User.deleteMany({ _id: { $in: userIds } })).deletedCount;
  counts.careerArticles = (
    await CareerArticle.deleteMany({ slug: { $in: allArticleSlugs() } })
  ).deletedCount;
  counts.subscriptionPlans = (
    await SubscriptionPlan.deleteMany({ slug: { $in: allPlanSlugs() } })
  ).deletedCount;
  counts.categories = (
    await Category.deleteMany({ slug: { $in: allCategorySlugs() } })
  ).deletedCount;
  counts.locations = (
    await Location.deleteMany({ slug: { $in: allLocationSlugs() } })
  ).deletedCount;

  return counts;
}
