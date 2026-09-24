import { Application } from '../models/Application';
import { Candidate } from '../models/Candidate';
import { Job } from '../models/Job';
import { Notification } from '../models/Notification';
import { Subscription } from '../models/Subscription';
import { User } from '../models/User';
import { scoreJobMatch } from '../utils/matchScore';
import { notifySafely, resolveEmployerUserId } from './notification.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Employer digests: job performance (311), plan expiry (312), candidate recommendations (313).
 * Run via `npm run worker:employer-digests`.
 */
export class EmployerDigestService {
  async runDigestPass(now = new Date()): Promise<{
    performance: number;
    subscriptions: number;
    recommendations: number;
  }> {
    const [performance, subscriptions, recommendations] = await Promise.all([
      this.notifyJobPerformance(now),
      this.notifySubscriptionExpiry(now),
      this.notifyCandidateRecommendations(now),
    ]);
    return { performance, subscriptions, recommendations };
  }

  /** 311 — Jobs that received meaningful application volume recently. */
  private async notifyJobPerformance(now: Date): Promise<number> {
    const since = new Date(now.getTime() - 7 * MS_PER_DAY);
    const jobs = await Job.find({
      deletedAt: null,
      status: 'published',
      publishedAt: { $lte: since },
    })
      .select('title employerId applicationsCount')
      .limit(100);

    let sent = 0;
    for (const job of jobs) {
      const recentCount = await Application.countDocuments({
        jobId: job._id,
        appliedAt: { $gte: since },
      });
      if (recentCount < 5) continue;

      const employerUserId = await resolveEmployerUserId(job.employerId);
      if (!employerUserId) continue;

      // Avoid spamming: one performance note per job per week.
      const already = await Notification.findOne({
        recipientId: employerUserId,
        type: 'JOB_PERFORMANCE',
        'data.jobId': job._id.toString(),
        createdAt: { $gte: new Date(now.getTime() - 6 * MS_PER_DAY) },
      }).select('_id');
      if (already) continue;

      await notifySafely({
        recipientId: employerUserId,
        type: 'JOB_PERFORMANCE',
        title: 'Job performance update',
        message: `"${job.title}" received ${recentCount} applications in the last 7 days.`,
        data: {
          jobId: job._id.toString(),
          recentApplications: recentCount,
          totalApplications: job.applicationsCount ?? recentCount,
        },
      });
      sent += 1;
    }
    return sent;
  }

  /** 312 — Active plans ending soon. */
  private async notifySubscriptionExpiry(now: Date): Promise<number> {
    const windowEnd = new Date(now.getTime() + 7 * MS_PER_DAY);
    const subs = await Subscription.find({
      status: { $in: ['active', 'trial'] },
      endDate: { $gt: now, $lte: windowEnd },
    }).limit(100);

    let sent = 0;

    for (const sub of subs) {
      const recipientId = sub.userId?.toString();
      if (!recipientId) continue;

      const already = await Notification.findOne({
        recipientId,
        type: 'SUBSCRIPTION_EXPIRY',
        'data.subscriptionId': sub._id.toString(),
        createdAt: { $gte: new Date(now.getTime() - 5 * MS_PER_DAY) },
      }).select('_id');
      if (already) continue;

      const daysLeft = Math.max(
        1,
        Math.ceil((sub.endDate!.getTime() - now.getTime()) / MS_PER_DAY),
      );
      await notifySafely({
        recipientId,
        type: 'SUBSCRIPTION_EXPIRY',
        title: 'Plan expiring soon',
        message: `Your hiring plan ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew to keep posting and contacting candidates.`,
        data: {
          subscriptionId: sub._id.toString(),
          endDate: sub.endDate!.toISOString(),
          daysLeft,
        },
      });
      sent += 1;
    }
    return sent;
  }

  /** 313 — Recommend a strong public candidate for each active job. */
  private async notifyCandidateRecommendations(now: Date): Promise<number> {
    const jobs = await Job.find({
      deletedAt: null,
      status: 'published',
    })
      .select(
        'title employerId skills requirements experienceMin experienceMax salaryMin salaryMax workMode location',
      )
      .limit(40);

    let sent = 0;

    for (const job of jobs) {
      const employerUserId = await resolveEmployerUserId(job.employerId);
      if (!employerUserId) continue;

      const already = await Notification.findOne({
        recipientId: employerUserId,
        type: 'CANDIDATE_RECOMMENDATION',
        'data.jobId': job._id.toString(),
        createdAt: { $gte: new Date(now.getTime() - 3 * MS_PER_DAY) },
      }).select('_id');
      if (already) continue;

      const candidates = await Candidate.find({
        profileVisibility: { $in: ['public', 'employers_only'] },
        openToWork: { $ne: false },
      })
        .sort({ updatedAt: -1 })
        .limit(80);

      const jobSource = {
        title: job.title,
        skills: job.skills,
        requirements: job.requirements,
        experienceMin: job.experienceMin,
        experienceMax: job.experienceMax,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        workMode: job.workMode,
        locationText: [job.location?.address, job.location?.city, job.location?.displayName]
          .filter(Boolean)
          .join(' '),
        latitude: typeof job.location?.latitude === 'number' ? job.location.latitude : null,
        longitude: typeof job.location?.longitude === 'number' ? job.location.longitude : null,
      };

      let best: { candidateId: string; name: string; score: number } | null = null;
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
        if (match.overall < 75) continue;
        if (!best || match.overall > best.score) {
          const user = await User.findById(candidate.userId).select('name');
          best = {
            candidateId: candidate._id.toString(),
            name: user?.name?.trim() || 'A candidate',
            score: match.overall,
          };
        }
      }

      if (!best) continue;

      await notifySafely({
        recipientId: employerUserId,
        type: 'CANDIDATE_RECOMMENDATION',
        title: 'Candidate recommendation',
        message: `${best.name} looks like a ${best.score}% fit for "${job.title}".`,
        data: {
          jobId: job._id.toString(),
          candidateId: best.candidateId,
          matchPercentage: best.score,
        },
      });
      sent += 1;
    }
    return sent;
  }
}

export const employerDigestService = new EmployerDigestService();
