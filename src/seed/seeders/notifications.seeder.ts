import { Notification } from '../../models/Notification';
import type { NotificationType } from '../../constants/enums';
import { NOTIFICATION_READ_RATIO, SEED_COUNTS, SEED_META_FLAG, demoEmail } from '../config';
import { DEMO_PERSONAS } from '../data/personas';
import { daysAgo } from '../helpers/dates';
import { createSeededRng, pick } from '../helpers/rng';
import type { SeedContext } from '../types';

const CANDIDATE_TYPES: NotificationType[] = [
  'APPLICATION_SUBMITTED',
  'APPLICATION_STATUS_CHANGED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_RESCHEDULED',
  'INTERVIEW_CANCELLED',
  'INTERVIEW_CONFIRMED',
  'INTERVIEW_DECLINED',
  'SYSTEM',
];

const EMPLOYER_TYPES: NotificationType[] = [
  'APPLICATION_SUBMITTED',
  'APPLICATION_STATUS_CHANGED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_CONFIRMED',
  'INTERVIEW_DECLINED',
  'JOB_STATUS_CHANGED',
  'REPORT_STATUS_CHANGED',
  'SYSTEM',
];

function titleFor(type: NotificationType): string {
  switch (type) {
    case 'APPLICATION_SUBMITTED':
      return 'New application submitted';
    case 'APPLICATION_STATUS_CHANGED':
      return 'Application status updated';
    case 'INTERVIEW_SCHEDULED':
      return 'Interview scheduled';
    case 'INTERVIEW_RESCHEDULED':
      return 'Interview rescheduled';
    case 'INTERVIEW_CANCELLED':
      return 'Interview cancelled';
    case 'INTERVIEW_CONFIRMED':
      return 'Interview confirmed';
    case 'INTERVIEW_DECLINED':
      return 'Interview declined';
    case 'JOB_STATUS_CHANGED':
      return 'Job status changed';
    case 'REPORT_STATUS_CHANGED':
      return 'Report status updated';
    default:
      return 'System notice';
  }
}

export async function seedNotifications(ctx: SeedContext): Promise<void> {
  const rng = createSeededRng(121);
  const target = SEED_COUNTS.notifications;

  const demoUserIds = [
    ...ctx.candidates.map((c) => c.userId),
    ...ctx.employers.map((e) => e.userId),
  ];
  await Notification.deleteMany({
    recipientId: { $in: demoUserIds },
    'data.seedMode': SEED_META_FLAG,
  });

  const docs: Array<Record<string, unknown>> = [];

  const pushNotif = (
    recipientId: (typeof demoUserIds)[number],
    recipientName: string,
    type: NotificationType,
    index: number,
    ageDays: number,
  ) => {
    // Recent notifications more likely unread; overall ~72% read
    const recent = ageDays <= 3;
    const read = recent ? rng() < 0.35 : rng() < NOTIFICATION_READ_RATIO;
    const relatedApp = ctx.applications[index % Math.max(ctx.applications.length, 1)];
    const relatedJob = ctx.jobs[index % Math.max(ctx.jobs.length, 1)];

    docs.push({
      recipientId,
      type,
      title: titleFor(type),
      message: `${titleFor(type)} — update for ${recipientName}.`,
      data: {
        seedMode: SEED_META_FLAG,
        seedKey: `demo-notification-${index + 1}`,
        applicationId: relatedApp?.applicationId?.toString(),
        jobId: relatedJob?.jobId?.toString(),
      },
      read,
      readAt: read ? daysAgo(Math.min(ageDays, Math.floor(rng() * 15))) : undefined,
      createdAt: daysAgo(ageDays),
    });
  };

  // Ensure demo personas have a visible unread stack
  const complete = ctx.candidates.find(
    (c) => c.email === demoEmail(DEMO_PERSONAS.candidateComplete.emailLocal),
  );
  const activeEmp = ctx.employers.find(
    (e) => e.email === demoEmail(DEMO_PERSONAS.employerActive.emailLocal),
  );

  if (complete) {
    for (let i = 0; i < 8; i += 1) {
      pushNotif(complete.userId, complete.name, pick(rng, CANDIDATE_TYPES), i, i <= 2 ? i : 5 + i);
    }
  }
  if (activeEmp) {
    for (let i = 0; i < 6; i += 1) {
      pushNotif(activeEmp.userId, activeEmp.name, pick(rng, EMPLOYER_TYPES), 100 + i, i);
    }
  }

  for (let i = docs.length; i < target; i += 1) {
    const forCandidate = i % 3 !== 0;
    const recipient = forCandidate
      ? ctx.candidates[i % ctx.candidates.length]!
      : ctx.employers[i % ctx.employers.length]!;
    const type = forCandidate ? pick(rng, CANDIDATE_TYPES) : pick(rng, EMPLOYER_TYPES);
    const ageDays = Math.floor(rng() * 40);
    pushNotif(recipient.userId, recipient.name, type, i, ageDays);
  }

  const chunkSize = 50;
  for (let i = 0; i < docs.length; i += chunkSize) {
    await Notification.insertMany(docs.slice(i, i + chunkSize), { ordered: false });
  }

  ctx.summary.notifications = docs.length;
}
