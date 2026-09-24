import { Job } from '../models/Job';
import { notifySafely, resolveEmployerUserId } from './notification.service';
import { markExpiredJobsForCompany } from './entitlement.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Notify employers this many days before listing expiry. */
const REMINDER_WINDOW_DAYS = 3;

/**
 * Employer-facing listing expiry reminders (sheet 227).
 * Soft-expires past-due jobs, then notifies owners of jobs ending soon.
 */
export class JobExpiryReminderService {
  async runExpiryReminderPass(now = new Date()): Promise<{
    expired: number;
    reminded: number;
  }> {
    const expireResult = await Job.updateMany(
      {
        deletedAt: null,
        status: { $in: ['published', 'paused'] },
        expiresAt: { $ne: null, $lte: now },
      },
      { $set: { status: 'expired' } },
    );

    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * MS_PER_DAY);
    const candidates = await Job.find({
      deletedAt: null,
      status: { $in: ['published', 'paused'] },
      expiresAt: { $gt: now, $lte: windowEnd },
      $or: [
        { expiryReminderSentAt: null },
        { expiryReminderSentAt: { $exists: false } },
        {
          expiryReminderSentAt: {
            $lte: new Date(now.getTime() - REMINDER_WINDOW_DAYS * MS_PER_DAY),
          },
        },
      ],
    })
      .select('title employerId companyId expiresAt')
      .limit(500);

    let reminded = 0;
    const touchedCompanies = new Set<string>();

    for (const job of candidates) {
      const employerUserId = await resolveEmployerUserId(job.employerId);
      if (!employerUserId || !job.expiresAt) continue;

      const daysLeft = Math.max(
        1,
        Math.ceil((job.expiresAt.getTime() - now.getTime()) / MS_PER_DAY),
      );

      await notifySafely({
        recipientId: employerUserId,
        type: 'JOB_EXPIRY_REMINDER',
        title: 'Job listing expiring soon',
        message: `"${job.title}" expires in about ${daysLeft} day(s). Extend or renew to keep it live.`,
        data: {
          jobId: job._id.toString(),
          expiresAt: job.expiresAt.toISOString(),
          daysLeft,
        },
      });

      job.expiryReminderSentAt = now;
      await job.save();
      reminded += 1;
      touchedCompanies.add(job.companyId.toString());
    }

    for (const companyId of touchedCompanies) {
      await markExpiredJobsForCompany(companyId, now).catch(() => 0);
    }

    return {
      expired: expireResult.modifiedCount ?? 0,
      reminded,
    };
  }
}

export const jobExpiryReminderService = new JobExpiryReminderService();
