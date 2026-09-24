import { Job } from '../models/Job';
import { Interview } from '../models/Interview';
import { ACTIVE_INTERVIEW_STATUSES } from '../utils/interviewStatus';
import {
  notifySafely,
  resolveCandidateUserId,
  resolveEmployerUserId,
} from './notification.service';

const HOUR_MS = 60 * 60 * 1000;
/** Window around each target so hourly cron still catches the reminder. */
const WINDOW_MS = 15 * 60 * 1000;

export type InterviewReminderPassResult = {
  scanned24h: number;
  sent24h: number;
  scanned1h: number;
  sent1h: number;
};

/**
 * Interview reminders for candidates + employers (sheet 130–131, 308).
 * Idempotent via reminder24hSentAt / reminder1hSentAt.
 */
export class InterviewReminderService {
  async runReminderPass(now = new Date()): Promise<InterviewReminderPassResult> {
    const [r24, r1] = await Promise.all([
      this.sendWindowReminders({
        now,
        hoursAhead: 24,
        field: 'reminder24hSentAt',
        type: 'INTERVIEW_REMINDER_24H',
        candidateTitle: 'Interview in 24 hours',
        candidatePrefix: 'Your interview',
        employerTitle: 'Interview reminder — 24 hours',
        employerPrefix: 'Upcoming interview',
      }),
      this.sendWindowReminders({
        now,
        hoursAhead: 1,
        field: 'reminder1hSentAt',
        type: 'INTERVIEW_REMINDER_1H',
        candidateTitle: 'Interview in 1 hour',
        candidatePrefix: 'Your interview starts soon',
        employerTitle: 'Interview reminder — 1 hour',
        employerPrefix: 'Interview starts soon',
      }),
    ]);

    return {
      scanned24h: r24.scanned,
      sent24h: r24.sent,
      scanned1h: r1.scanned,
      sent1h: r1.sent,
    };
  }

  private async sendWindowReminders(opts: {
    now: Date;
    hoursAhead: number;
    field: 'reminder24hSentAt' | 'reminder1hSentAt';
    type: 'INTERVIEW_REMINDER_24H' | 'INTERVIEW_REMINDER_1H';
    candidateTitle: string;
    candidatePrefix: string;
    employerTitle: string;
    employerPrefix: string;
  }): Promise<{ scanned: number; sent: number }> {
    const center = opts.now.getTime() + opts.hoursAhead * HOUR_MS;
    const from = new Date(center - WINDOW_MS);
    const to = new Date(center + WINDOW_MS);

    const rows = await Interview.find({
      status: { $in: ACTIVE_INTERVIEW_STATUSES },
      scheduledAt: { $gte: from, $lte: to },
      $or: [{ [opts.field]: null }, { [opts.field]: { $exists: false } }],
    }).limit(200);

    let sent = 0;
    for (const interview of rows) {
      const [candidateUserId, employerUserId, job] = await Promise.all([
        resolveCandidateUserId(interview.candidateId),
        resolveEmployerUserId(interview.employerId),
        Job.findById(interview.jobId).select('title'),
      ]);

      const when = interview.scheduledAt.toISOString();
      const jobTitle = job?.title;
      const data = {
        interviewId: interview._id.toString(),
        applicationId: interview.applicationId.toString(),
        jobId: interview.jobId.toString(),
        scheduledAt: when,
        reminderHours: opts.hoursAhead,
      };

      if (candidateUserId) {
        await notifySafely({
          recipientId: candidateUserId,
          type: opts.type,
          title: opts.candidateTitle,
          message: jobTitle
            ? `${opts.candidatePrefix} for "${jobTitle}" is at ${when}.`
            : `${opts.candidatePrefix} is at ${when}.`,
          data,
        });
      }

      // 308 — Employer also gets the reminder.
      if (employerUserId) {
        await notifySafely({
          recipientId: employerUserId,
          type: opts.type,
          title: opts.employerTitle,
          message: jobTitle
            ? `${opts.employerPrefix} for "${jobTitle}" is at ${when}.`
            : `${opts.employerPrefix} is at ${when}.`,
          data,
        });
      }

      interview.set(opts.field, opts.now);
      await interview.save();
      sent += 1;
    }

    return { scanned: rows.length, sent };
  }
}

export const interviewReminderService = new InterviewReminderService();
