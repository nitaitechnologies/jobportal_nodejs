import mongoose from 'mongoose';
import type { NotificationType } from '../constants/enums';
import { AlertDelivery } from '../models/AlertDelivery';
import { Candidate } from '../models/Candidate';
import { CandidateAlertSettings } from '../models/CandidateAlertSettings';
import { Category } from '../models/Category';
import { Job } from '../models/Job';
import { SavedJob } from '../models/SavedJob';
import { SavedSearch } from '../models/SavedSearch';
import { haversineKm } from '../utils/geo';
import {
  isDigestDue,
  jobMatchesSavedSearchFilters,
  looksLikeGovernmentJob,
} from '../utils/jobAlertMatch';
import { scoreJobMatch } from '../utils/matchScore';
import { notifySafely, resolveCandidateUserId } from './notification.service';
import { trackSafely } from './analytics.service';

const INSTANT_RECIPIENT_CAP = 200;
const DIGEST_JOB_CAP = 10;

type JobDoc = {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string | null;
  slug?: string;
  categoryId?: mongoose.Types.ObjectId | null;
  companyId: mongoose.Types.ObjectId;
  employerId: mongoose.Types.ObjectId;
  location?: {
    locationId?: mongoose.Types.ObjectId | null;
    latitude?: number | null;
    longitude?: number | null;
    city?: string | null;
    displayName?: string | null;
  } | null;
  workMode?: string | null;
  employmentType?: string | null;
  experienceMin?: number | null;
  experienceMax?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  featured?: boolean | null;
  urgent?: boolean | null;
  skills?: string[] | null;
  requirements?: string[] | null;
  applicationDeadline?: Date | null;
  expiresAt?: Date | null;
  publishedAt?: Date | null;
  status?: string;
  deletedAt?: Date | null;
};

async function claimDelivery(
  candidateId: mongoose.Types.ObjectId | string,
  jobId: mongoose.Types.ObjectId | string,
  type: NotificationType,
  savedSearchId?: mongoose.Types.ObjectId | string,
): Promise<boolean> {
  try {
    await AlertDelivery.create({
      candidateId,
      jobId,
      type,
      ...(savedSearchId ? { savedSearchId } : {}),
    });
    return true;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    ) {
      return false;
    }
    throw error;
  }
}

async function loadCategoryMeta(categoryId?: mongoose.Types.ObjectId | null) {
  if (!categoryId) return null;
  const category = await Category.findById(categoryId).select('name slug');
  if (!category) return null;
  return { name: category.name, slug: category.slug };
}

async function sendJobAlert(input: {
  candidateId: string;
  type: NotificationType;
  title: string;
  message: string;
  job: JobDoc;
  savedSearchId?: string;
  extraData?: Record<string, unknown>;
}): Promise<boolean> {
  const claimed = await claimDelivery(
    input.candidateId,
    input.job._id,
    input.type,
    input.savedSearchId,
  );
  if (!claimed) return false;

  const userId = await resolveCandidateUserId(input.candidateId);
  if (!userId) return false;

  await notifySafely({
    recipientId: userId,
    type: input.type,
    title: input.title,
    message: input.message,
    data: {
      jobId: input.job._id.toString(),
      jobTitle: input.job.title,
      ...(input.savedSearchId ? { savedSearchId: input.savedSearchId } : {}),
      ...(input.extraData ?? {}),
    },
  });

  await trackSafely({
    eventType: 'job_alert_sent',
    actorRole: 'system',
    entityType: 'job',
    entityId: input.job._id,
    jobId: input.job._id,
    candidateId: input.candidateId,
    companyId: input.job.companyId,
    employerId: input.job.employerId,
    metadata: { type: input.type },
  });

  return true;
}

export class JobAlertService {
  /**
   * Instant alerts after a job becomes publicly visible (074, 077–080, 082).
   */
  async onJobPublished(jobId: string | mongoose.Types.ObjectId): Promise<{ sent: number }> {
    const job = (await Job.findById(jobId)) as JobDoc | null;
    if (!job || job.status !== 'published') {
      return { sent: 0 };
    }
    return this.dispatchInstantForJob(job);
  }

  /**
   * Hot-job alerts when admin flips featured/urgent on (080).
   */
  async onJobHotFlagged(jobId: string | mongoose.Types.ObjectId): Promise<{ sent: number }> {
    const job = (await Job.findById(jobId)) as JobDoc | null;
    if (!job || job.status !== 'published') {
      return { sent: 0 };
    }
    if (!job.featured && !job.urgent) {
      return { sent: 0 };
    }

    let sent = 0;
    const settings = await CandidateAlertSettings.find({ hotJobs: true }).limit(
      INSTANT_RECIPIENT_CAP,
    );
    for (const setting of settings) {
      const ok = await sendJobAlert({
        candidateId: setting.candidateId.toString(),
        type: 'HOT_JOB',
        title: 'Hot job alert',
        message: `"${job.title}" was marked as a hot job.`,
        job,
      });
      if (ok) sent += 1;
    }
    return { sent };
  }

  private async dispatchInstantForJob(job: JobDoc): Promise<{ sent: number }> {
    let sent = 0;
    const categoryMeta = await loadCategoryMeta(job.categoryId);
    const isGov = looksLikeGovernmentJob({
      title: job.title,
      description: job.description,
      categorySlug: categoryMeta?.slug,
      categoryName: categoryMeta?.name,
    });
    const isHot = Boolean(job.featured || job.urgent);

    const instantSearches = await SavedSearch.find({
      isActive: true,
      frequency: 'instant',
    }).limit(500);

    for (const search of instantSearches) {
      if (
        !jobMatchesSavedSearchFilters(job, search.filters as Record<string, unknown>, categoryMeta)
      ) {
        continue;
      }
      const ok = await sendJobAlert({
        candidateId: search.candidateId.toString(),
        type: 'JOB_ALERT_INSTANT',
        title: 'New job matches your saved search',
        message: `"${job.title}" matches "${search.name}".`,
        job,
        savedSearchId: search._id.toString(),
      });
      if (ok) {
        sent += 1;
        search.lastMatchedAt = new Date();
        search.lastNotifiedAt = new Date();
        await search.save();
      }
      if (sent >= INSTANT_RECIPIENT_CAP) break;
    }

    const settingsList = await CandidateAlertSettings.find({
      $or: [
        { matchingJobs: true },
        { nearbyJobs: true },
        { salaryAlerts: true },
        { hotJobs: true },
        { governmentJobs: true },
      ],
    }).limit(800);

    const candidateIds = settingsList.map((s) => s.candidateId);
    const candidates = await Candidate.find({ _id: { $in: candidateIds } });
    const candidateMap = new Map(candidates.map((c) => [c._id.toString(), c]));

    for (const settings of settingsList) {
      if (sent >= INSTANT_RECIPIENT_CAP) break;
      const candidate = candidateMap.get(settings.candidateId.toString());
      if (!candidate) continue;
      const cid = candidate._id.toString();

      if (settings.matchingJobs !== false) {
        const match = scoreJobMatch(
          {
            title: job.title,
            skills: job.skills,
            requirements: job.requirements,
            experienceMin: job.experienceMin,
            experienceMax: job.experienceMax,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            workMode: job.workMode,
            locationText: [job.location?.city, job.location?.displayName]
              .filter(Boolean)
              .join(' '),
            latitude: job.location?.latitude,
            longitude: job.location?.longitude,
          },
          {
            headline: candidate.headline,
            currentJobTitle: candidate.currentJobTitle,
            skills: candidate.skills,
            totalExperience: candidate.totalExperience,
            expectedSalary: candidate.expectedSalary,
            currentLocation: candidate.currentLocation,
            latitude: candidate.latitude,
            longitude: candidate.longitude,
          },
        );
        const minScore = settings.matchScoreMin ?? 60;
        if (match.overall >= minScore) {
          const ok = await sendJobAlert({
            candidateId: cid,
            type: 'JOB_MATCH',
            title: 'New matching job',
            message: `"${job.title}" looks like a ${match.overall}% match for your profile.`,
            job,
            extraData: { matchScore: match.overall },
          });
          if (ok) sent += 1;
        }
      }

      if (settings.nearbyJobs !== false) {
        const cLat = candidate.latitude;
        const cLng = candidate.longitude;
        const jLat = job.location?.latitude;
        const jLng = job.location?.longitude;
        if (
          typeof cLat === 'number' &&
          typeof cLng === 'number' &&
          typeof jLat === 'number' &&
          typeof jLng === 'number'
        ) {
          const km = haversineKm(
            { latitude: cLat, longitude: cLng },
            { latitude: jLat, longitude: jLng },
          );
          const radius = settings.nearbyRadiusKm ?? 25;
          if (km <= radius) {
            const ok = await sendJobAlert({
              candidateId: cid,
              type: 'JOB_NEARBY',
              title: 'Nearby job alert',
              message: `"${job.title}" is about ${km} km from you.`,
              job,
              extraData: { distanceKm: km },
            });
            if (ok) sent += 1;
          }
        }
      }

      if (settings.salaryAlerts !== false && typeof candidate.expectedSalary === 'number') {
        const jobMax = job.salaryMax ?? job.salaryMin ?? null;
        if (typeof jobMax === 'number' && jobMax >= candidate.expectedSalary) {
          const ok = await sendJobAlert({
            candidateId: cid,
            type: 'JOB_SALARY_MATCH',
            title: 'Salary alert',
            message: `"${job.title}" meets or exceeds your expected salary.`,
            job,
          });
          if (ok) sent += 1;
        }
      }

      if (settings.hotJobs !== false && isHot) {
        const ok = await sendJobAlert({
          candidateId: cid,
          type: 'HOT_JOB',
          title: 'Hot job alert',
          message: `"${job.title}" is featured/urgent.`,
          job,
        });
        if (ok) sent += 1;
      }

      if (settings.governmentJobs !== false && isGov) {
        const ok = await sendJobAlert({
          candidateId: cid,
          type: 'GOVERNMENT_JOB',
          title: 'Government job / exam alert',
          message: `"${job.title}" looks like a government or exam-related opening.`,
          job,
        });
        if (ok) sent += 1;
      }
    }

    return { sent };
  }

  /**
   * Daily + weekly digests for saved searches and preference digests (075–076).
   */
  async runDigests(now = new Date()): Promise<{
    daily: number;
    weekly: number;
    preference: number;
  }> {
    let daily = 0;
    let weekly = 0;
    let preference = 0;

    const searches = await SavedSearch.find({
      isActive: true,
      frequency: { $in: ['daily', 'weekly'] },
    }).limit(2000);

    for (const search of searches) {
      if (!isDigestDue(search.frequency, search.lastNotifiedAt, now)) continue;

      const since = search.lastNotifiedAt ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const jobs = (await Job.find({
        status: 'published',
        deletedAt: null,
        publishedAt: { $gte: since },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      })
        .sort({ publishedAt: -1 })
        .limit(80)) as JobDoc[];

      const matched: JobDoc[] = [];
      for (const job of jobs) {
        const categoryMeta = await loadCategoryMeta(job.categoryId);
        if (
          jobMatchesSavedSearchFilters(
            job,
            search.filters as Record<string, unknown>,
            categoryMeta,
          )
        ) {
          matched.push(job);
        }
        if (matched.length >= DIGEST_JOB_CAP) break;
      }

      if (matched.length === 0) {
        search.lastNotifiedAt = now;
        await search.save();
        continue;
      }

      const type: NotificationType =
        search.frequency === 'weekly' ? 'JOB_ALERT_WEEKLY' : 'JOB_ALERT_DAILY';
      const userId = await resolveCandidateUserId(search.candidateId);
      if (!userId) continue;

      const titles = matched.map((j) => j.title).slice(0, 3).join(', ');
      await notifySafely({
        recipientId: userId,
        type,
        title: search.frequency === 'weekly' ? 'Weekly job alert' : 'Daily job alert',
        message: `${matched.length} new job(s) for "${search.name}": ${titles}`,
        data: {
          savedSearchId: search._id.toString(),
          jobIds: matched.map((j) => j._id.toString()).join(','),
          count: matched.length,
        },
      });

      for (const job of matched) {
        await claimDelivery(search.candidateId, job._id, type, search._id);
      }

      search.lastMatchedAt = now;
      search.lastNotifiedAt = now;
      await search.save();

      if (search.frequency === 'weekly') weekly += 1;
      else daily += 1;
    }

    const prefSettings = await CandidateAlertSettings.find({
      digestFrequency: { $in: ['daily', 'weekly'] },
      matchingJobs: true,
    }).limit(1000);

    for (const settings of prefSettings) {
      if (!isDigestDue(String(settings.digestFrequency), settings.lastDigestAt, now)) {
        continue;
      }
      const candidate = await Candidate.findById(settings.candidateId);
      if (!candidate) continue;

      const since = settings.lastDigestAt ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const jobs = (await Job.find({
        status: 'published',
        deletedAt: null,
        publishedAt: { $gte: since },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      })
        .sort({ publishedAt: -1 })
        .limit(40)) as JobDoc[];

      const matched: Array<{ job: JobDoc; score: number }> = [];
      for (const job of jobs) {
        const match = scoreJobMatch(
          {
            title: job.title,
            skills: job.skills,
            requirements: job.requirements,
            experienceMin: job.experienceMin,
            experienceMax: job.experienceMax,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            workMode: job.workMode,
            latitude: job.location?.latitude,
            longitude: job.location?.longitude,
          },
          {
            headline: candidate.headline,
            currentJobTitle: candidate.currentJobTitle,
            skills: candidate.skills,
            totalExperience: candidate.totalExperience,
            expectedSalary: candidate.expectedSalary,
            currentLocation: candidate.currentLocation,
            latitude: candidate.latitude,
            longitude: candidate.longitude,
          },
        );
        if (match.overall >= (settings.matchScoreMin ?? 60)) {
          matched.push({ job, score: match.overall });
        }
        if (matched.length >= DIGEST_JOB_CAP) break;
      }

      settings.lastDigestAt = now;
      await settings.save();
      if (matched.length === 0) continue;

      const userId = await resolveCandidateUserId(settings.candidateId);
      if (!userId) continue;
      const type: NotificationType =
        settings.digestFrequency === 'weekly' ? 'JOB_ALERT_WEEKLY' : 'JOB_ALERT_DAILY';
      await notifySafely({
        recipientId: userId,
        type,
        title: 'Matching jobs digest',
        message: `${matched.length} new job(s) match your profile.`,
        data: {
          jobIds: matched.map((m) => m.job._id.toString()).join(','),
          count: matched.length,
        },
      });
      preference += 1;
    }

    return { daily, weekly, preference };
  }

  /**
   * Deadline / expiry reminders for saved jobs (081).
   */
  async runDeadlineAlerts(now = new Date()): Promise<{ sent: number }> {
    const settingsByCandidate = new Map(
      (await CandidateAlertSettings.find({ deadlineAlerts: { $ne: false } })).map((s) => [
        s.candidateId.toString(),
        s,
      ]),
    );

    const saved = await SavedJob.find({}).limit(5000);
    let sent = 0;

    for (const row of saved) {
      const settings = settingsByCandidate.get(row.candidateId.toString());
      const days = settings?.deadlineDays ?? 3;
      if (settings && settings.deadlineAlerts === false) continue;

      const job = (await Job.findById(row.jobId).select(
        'title status applicationDeadline expiresAt companyId employerId deletedAt',
      )) as JobDoc | null;
      if (!job || job.status !== 'published' || job.deletedAt) continue;

      const deadline = job.applicationDeadline ?? job.expiresAt;
      if (!deadline) continue;

      const msLeft = deadline.getTime() - now.getTime();
      if (msLeft <= 0) continue;
      const daysLeft = msLeft / (24 * 60 * 60 * 1000);
      if (daysLeft > days) continue;

      const ok = await sendJobAlert({
        candidateId: row.candidateId.toString(),
        type: 'JOB_DEADLINE',
        title: 'Job deadline reminder',
        message: `"${job.title}" closes in about ${Math.max(1, Math.ceil(daysLeft))} day(s).`,
        job: job as JobDoc,
        extraData: { deadline: deadline.toISOString() },
      });
      if (ok) sent += 1;
    }

    return { sent };
  }

  /**
   * Boost (318–319): push HOT_JOB only to candidates who match the JD (min score).
   */
  async notifyMatchingCandidatesForBoost(
    jobId: string | mongoose.Types.ObjectId,
    opts: { minScore?: number; limit?: number } = {},
  ): Promise<{ sent: number; scanned: number }> {
    const job = (await Job.findById(jobId)) as JobDoc | null;
    if (!job || job.status !== 'published' || job.deletedAt) {
      return { sent: 0, scanned: 0 };
    }

    const minScore = opts.minScore ?? 60;
    const limit = Math.min(80, Math.max(1, opts.limit ?? 40));
    const candidates = await Candidate.find({
      profileVisibility: { $in: ['public', 'employers_only'] },
      openToWork: { $ne: false },
    })
      .sort({ updatedAt: -1 })
      .limit(400);

    const jobSource = {
      title: job.title,
      skills: job.skills,
      requirements: job.requirements,
      experienceMin: job.experienceMin,
      experienceMax: job.experienceMax,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      workMode: job.workMode,
      locationText: [job.location?.city, job.location?.displayName].filter(Boolean).join(' '),
      latitude: typeof job.location?.latitude === 'number' ? job.location.latitude : null,
      longitude: typeof job.location?.longitude === 'number' ? job.location.longitude : null,
    };

    const scored: Array<{ candidateId: string; score: number }> = [];
    for (const candidate of candidates) {
      const match = scoreJobMatch(jobSource, {
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
      });
      if (match.overall >= minScore) {
        scored.push({ candidateId: candidate._id.toString(), score: match.overall });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, limit);

    let sent = 0;
    for (const row of top) {
      const ok = await sendJobAlert({
        candidateId: row.candidateId,
        type: 'HOT_JOB',
        title: 'Boosted job match',
        message: `"${job.title}" looks like a ${row.score}% match for your profile.`,
        job,
        extraData: { matchPercentage: row.score, boost: true },
      });
      if (ok) sent += 1;
    }

    return { sent, scanned: scored.length };
  }

  /** Full scheduled pass: digests + deadlines. */
  async runScheduledPass(): Promise<{
    digests: { daily: number; weekly: number; preference: number };
    deadlines: { sent: number };
  }> {
    const digests = await this.runDigests();
    const deadlines = await this.runDeadlineAlerts();
    return { digests, deadlines };
  }
}

export const jobAlertService = new JobAlertService();
