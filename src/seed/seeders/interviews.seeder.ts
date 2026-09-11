import { Interview } from '../../models/Interview';
import type { InterviewStatus, InterviewType } from '../../constants/enums';
import { SEED_COUNTS, demoEmail } from '../config';
import { DEMO_PERSONAS } from '../data/personas';
import { daysAgo, daysFromNow } from '../helpers/dates';
import { createSeededRng, intBetween, pick } from '../helpers/rng';
import type { SeedApplicationRef, SeedContext } from '../types';

const TYPES: InterviewType[] = ['online', 'phone', 'onsite'];

function scheduleForIndex(
  created: number,
  rng: () => number,
): { status: InterviewStatus; scheduledAt: Date } {
  const bucket = created % 7;
  if (bucket === 0) {
    return { status: 'completed', scheduledAt: daysAgo(intBetween(rng, 2, 28)) };
  }
  if (bucket === 1) {
    return { status: 'cancelled', scheduledAt: daysAgo(intBetween(rng, 1, 14)) };
  }
  if (bucket === 2) {
    return { status: 'rescheduled', scheduledAt: daysFromNow(intBetween(rng, 2, 14)) };
  }
  if (bucket === 3) {
    return { status: 'confirmed', scheduledAt: daysFromNow(intBetween(rng, 1, 7)) };
  }
  if (bucket === 4) {
    return { status: 'scheduled', scheduledAt: daysFromNow(intBetween(rng, 1, 21)) };
  }
  if (bucket === 5) {
    return { status: 'declined', scheduledAt: daysAgo(intBetween(rng, 1, 10)) };
  }
  return { status: 'no-show', scheduledAt: daysAgo(intBetween(rng, 1, 12)) };
}

async function upsertInterview(
  ctx: SeedContext,
  app: SeedApplicationRef,
  created: number,
  rng: () => number,
  force?: { status: InterviewStatus; scheduledAt: Date },
): Promise<boolean> {
  const type = TYPES[created % TYPES.length]!;
  const { status, scheduledAt } = force ?? scheduleForIndex(created, rng);
  const employer = ctx.employers.find((e) => e.employerId.equals(app.employerId));

  await Interview.findOneAndUpdate(
    { applicationId: app.applicationId },
    {
      $set: {
        applicationId: app.applicationId,
        candidateId: app.candidateId,
        employerId: app.employerId,
        companyId: app.companyId,
        jobId: app.jobId,
        type,
        scheduledAt,
        duration: pick(rng, [30, 45, 60]),
        location: type === 'onsite' ? employer?.companyName ?? 'Office' : '',
        meetingLink: type === 'online' ? `https://meet.example/demo-interview-${created + 1}` : '',
        interviewer: employer?.name ?? 'Hiring Manager',
        notes: 'Demo interview seeded for local/staging UI.',
        status,
        cancellationReason: status === 'cancelled' ? 'Candidate requested reschedule window' : '',
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  return true;
}

export async function seedInterviews(ctx: SeedContext): Promise<void> {
  const rng = createSeededRng(111);

  await Interview.deleteMany({
    candidateId: { $in: ctx.candidates.map((c) => c.candidateId) },
  });

  const eligible = ctx.applications.filter((a) =>
    ['shortlisted', 'interview', 'hired', 'viewed'].includes(a.status),
  );
  const pool = eligible.length > 0 ? eligible : ctx.applications;
  const target = Math.min(SEED_COUNTS.interviews, pool.length);
  const usedApps = new Set<string>();
  let created = 0;

  // Persona upcoming interviews
  const completeEmail = demoEmail(DEMO_PERSONAS.candidateComplete.emailLocal);
  const activeEmail = demoEmail(DEMO_PERSONAS.candidateActive.emailLocal);
  const personaApps = ctx.applications.filter(
    (a) =>
      (a.candidateUserId &&
        ctx.candidates.find((c) => c.candidateId.equals(a.candidateId))?.email === completeEmail) ||
      ctx.candidates.find((c) => c.candidateId.equals(a.candidateId))?.email === activeEmail,
  );

  for (const app of personaApps.slice(0, 4)) {
    if (usedApps.has(app.applicationId.toString())) continue;
    usedApps.add(app.applicationId.toString());
    const force =
      created % 2 === 0
        ? { status: 'confirmed' as const, scheduledAt: daysFromNow(2 + created) }
        : { status: 'completed' as const, scheduledAt: daysAgo(5 + created) };
    await upsertInterview(ctx, app, created, rng, force);
    created += 1;
  }

  for (let i = 0; created < target && i < pool.length * 3; i += 1) {
    const app = pool[i % pool.length]!;
    const appKey = app.applicationId.toString();
    if (usedApps.has(appKey)) continue;
    usedApps.add(appKey);
    await upsertInterview(ctx, app, created, rng);
    created += 1;
  }

  ctx.summary.interviews = created;
}
