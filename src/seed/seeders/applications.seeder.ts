import { Application } from '../../models/Application';
import { Job } from '../../models/Job';
import type { ApplicationStatus } from '../../constants/enums';
import { SEED_COUNTS, demoEmail } from '../config';
import { DEMO_PERSONAS } from '../data/personas';
import { daysAgo } from '../helpers/dates';
import { createSeededRng, pick } from '../helpers/rng';
import type { SeedCandidateRef, SeedContext, SeedJobRef } from '../types';

const STATUS_POOL: ApplicationStatus[] = [
  'applied',
  'applied',
  'viewed',
  'viewed',
  'shortlisted',
  'interview',
  'interview',
  'rejected',
  'hired',
  'withdrawn',
];

const PERSONA_STATUS_CYCLE: ApplicationStatus[] = [
  'applied',
  'viewed',
  'shortlisted',
  'interview',
  'rejected',
  'hired',
  'withdrawn',
  'applied',
  'interview',
  'shortlisted',
  'viewed',
  'applied',
  'interview',
  'rejected',
  'hired',
];

function findCandidate(ctx: SeedContext, emailLocal: string): SeedCandidateRef | undefined {
  const email = demoEmail(emailLocal);
  return ctx.candidates.find((c) => c.email === email);
}

function eligibleCandidates(ctx: SeedContext): SeedCandidateRef[] {
  return ctx.candidates.filter((c) => c.profileCompletion >= 40);
}

async function upsertApplication(
  ctx: SeedContext,
  candidate: SeedCandidateRef,
  job: SeedJobRef,
  status: ApplicationStatus,
  rng: () => number,
  seen: Set<string>,
  jobAppCounts: Map<string, number>,
): Promise<boolean> {
  const key = `${candidate.candidateId.toString()}:${job.jobId.toString()}`;
  if (seen.has(key)) return false;
  seen.add(key);

  const employer = ctx.employers.find((e) => e.employerId.equals(job.employerId));
  if (!employer) return false;

  const appliedAt = daysAgo(Math.floor(rng() * 60));
  const viewedAt = ['viewed', 'shortlisted', 'interview', 'rejected', 'hired'].includes(status)
    ? daysAgo(Math.max(0, Math.floor(rng() * 45)))
    : undefined;
  const shortlistedAt = ['shortlisted', 'interview', 'hired'].includes(status)
    ? daysAgo(Math.max(0, Math.floor(rng() * 30)))
    : undefined;
  const rejectedAt = status === 'rejected' ? daysAgo(Math.max(0, Math.floor(rng() * 25))) : undefined;
  const hiredAt = status === 'hired' ? daysAgo(Math.max(0, Math.floor(rng() * 15))) : undefined;

  const application = await Application.findOneAndUpdate(
    { candidateId: candidate.candidateId, jobId: job.jobId },
    {
      $set: {
        candidateId: candidate.candidateId,
        jobId: job.jobId,
        employerId: job.employerId,
        companyId: job.companyId,
        resume: '',
        coverLetter:
          rng() > 0.35
            ? `I am excited to apply for the ${job.title} role at ${employer.companyName}.`
            : '',
        answers: [],
        status,
        appliedAt,
        viewedAt,
        shortlistedAt,
        rejectedAt,
        hiredAt,
        notes: '',
        source: 'platform',
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  ctx.applications.push({
    applicationId: application._id,
    candidateId: candidate.candidateId,
    jobId: job.jobId,
    employerId: job.employerId,
    companyId: job.companyId,
    status,
    candidateUserId: candidate.userId,
    employerUserId: employer.userId,
  });

  const jid = job.jobId.toString();
  jobAppCounts.set(jid, (jobAppCounts.get(jid) ?? 0) + 1);
  return true;
}

export async function seedApplications(ctx: SeedContext): Promise<void> {
  const rng = createSeededRng(103);
  const target = SEED_COUNTS.applications;
  const pool = ctx.publishedJobs.length > 0 ? ctx.publishedJobs : [];
  const seen = new Set<string>();
  const jobAppCounts = new Map<string, number>();
  let created = 0;

  if (pool.length === 0) {
    ctx.summary.applications = 0;
    return;
  }

  const eligible = eligibleCandidates(ctx);
  const complete = findCandidate(ctx, DEMO_PERSONAS.candidateComplete.emailLocal);
  const active = findCandidate(ctx, DEMO_PERSONAS.candidateActive.emailLocal);
  // Incomplete persona intentionally gets zero applications (below apply readiness)

  // Power-law job popularity: top jobs get many apps, some published get zero
  const popularity = [...pool].sort((a, b) => a.slug.localeCompare(b.slug));
  const popular = popularity.slice(0, Math.min(6, popularity.length));
  const medium = popularity.slice(6, Math.min(40, popularity.length));
  const low = popularity.slice(40);
  // Reserve ~8 published jobs with zero applications (do not include in assignment pools)
  const zeroSet = new Set(low.slice(-8).map((j) => j.slug));
  const lowPool = low.filter((j) => !zeroSet.has(j.slug));

  const assignMany = async (
    jobs: SeedJobRef[],
    perJob: number,
    candidates: SeedCandidateRef[],
  ) => {
    for (const job of jobs) {
      for (let n = 0; n < perJob && created < target; n += 1) {
        const candidate = candidates[(n + jobs.indexOf(job)) % candidates.length];
        if (!candidate) continue;
        const status = pick(rng, STATUS_POOL);
        if (await upsertApplication(ctx, candidate, job, status, rng, seen, jobAppCounts)) {
          created += 1;
        }
      }
    }
  };

  if (eligible.length > 0) {
    await assignMany(popular, 18, eligible); // 20+ style for popular
    await assignMany(medium, 8, eligible);
    await assignMany(lowPool, 2, eligible);
  }

  // Persona overlays with status variety
  for (const persona of [complete, active]) {
    if (!persona || persona.profileCompletion < 40) continue;
    const targetCount =
      persona.email === demoEmail(DEMO_PERSONAS.candidateComplete.emailLocal)
        ? DEMO_PERSONAS.candidateComplete.applicationTarget
        : DEMO_PERSONAS.candidateActive.applicationTarget;
    for (let i = 0; i < targetCount && created < target + 30; i += 1) {
      const job = pool[i % pool.length]!;
      const status = PERSONA_STATUS_CYCLE[i % PERSONA_STATUS_CYCLE.length]!;
      if (await upsertApplication(ctx, persona, job, status, rng, seen, jobAppCounts)) {
        created += 1;
      }
    }
  }

  // Fill remaining toward target with random eligible pairs
  let attempts = 0;
  while (created < target && attempts < target * 40 && eligible.length > 0) {
    attempts += 1;
    const candidate = eligible[Math.floor(rng() * eligible.length)]!;
    const job = pool[Math.floor(rng() * pool.length)]!;
    if (zeroSet.has(job.slug)) continue;
    const status = pick(rng, STATUS_POOL);
    if (await upsertApplication(ctx, candidate, job, status, rng, seen, jobAppCounts)) {
      created += 1;
    }
  }

  // Reset all demo job application counts then sync
  await Job.updateMany(
    { employerId: { $in: ctx.employers.map((e) => e.employerId) } },
    { $set: { applicationsCount: 0 } },
  );
  for (const [jobId, count] of jobAppCounts.entries()) {
    await Job.updateOne({ _id: jobId }, { $set: { applicationsCount: count } });
  }

  ctx.summary.applications = created;
}
