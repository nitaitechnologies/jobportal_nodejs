import { SavedJob } from '../../models/SavedJob';
import { SEED_COUNTS, demoEmail } from '../config';
import { DEMO_PERSONAS } from '../data/personas';
import { createSeededRng } from '../helpers/rng';
import type { SeedCandidateRef, SeedContext } from '../types';

function findCandidate(ctx: SeedContext, emailLocal: string): SeedCandidateRef | undefined {
  return ctx.candidates.find((c) => c.email === demoEmail(emailLocal));
}

export async function seedSavedJobs(ctx: SeedContext): Promise<void> {
  const rng = createSeededRng(91);
  const target = SEED_COUNTS.savedJobs;
  const pool = ctx.publishedJobs.length > 0 ? ctx.publishedJobs : ctx.jobs;
  const seen = new Set<string>();
  let created = 0;

  const savePair = async (candidate: SeedCandidateRef, jobIndex: number): Promise<boolean> => {
    const job = pool[jobIndex % pool.length];
    if (!job) return false;
    const key = `${candidate.candidateId.toString()}:${job.jobId.toString()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    await SavedJob.findOneAndUpdate(
      { candidateId: candidate.candidateId, jobId: job.jobId },
      { $setOnInsert: { candidateId: candidate.candidateId, jobId: job.jobId } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    return true;
  };

  // Persona overlays
  const complete = findCandidate(ctx, DEMO_PERSONAS.candidateComplete.emailLocal);
  const active = findCandidate(ctx, DEMO_PERSONAS.candidateActive.emailLocal);
  // incomplete: intentionally 0 saved

  if (complete) {
    for (let i = 0; i < DEMO_PERSONAS.candidateComplete.savedTarget; i += 1) {
      if (await savePair(complete, i * 3)) created += 1;
    }
  }
  if (active) {
    for (let i = 0; i < DEMO_PERSONAS.candidateActive.savedTarget; i += 1) {
      if (await savePair(active, i * 2 + 1)) created += 1;
    }
  }

  // Varied activity: ~25% candidates get 0, others 1–10
  let attempts = 0;
  while (created < target && attempts < target * 25) {
    attempts += 1;
    const candidate = ctx.candidates[Math.floor(rng() * ctx.candidates.length)]!;
    if (candidate.email === demoEmail(DEMO_PERSONAS.candidateIncomplete.emailLocal)) {
      continue;
    }
    // Skip some candidates entirely for 0-saved realism
    const candHash = candidate.candidateId.toString().charCodeAt(18) ?? 0;
    if (candHash % 4 === 0 && rng() < 0.7) continue;

    const job = pool[Math.floor(rng() * pool.length)]!;
    const key = `${candidate.candidateId.toString()}:${job.jobId.toString()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    await SavedJob.findOneAndUpdate(
      { candidateId: candidate.candidateId, jobId: job.jobId },
      { $setOnInsert: { candidateId: candidate.candidateId, jobId: job.jobId } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    created += 1;
  }

  ctx.summary.savedJobs = created;
}
