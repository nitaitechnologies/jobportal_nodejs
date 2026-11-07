/**
 * Ensure published jobs have male/female/any genderPreference for feed badges.
 * Usage: npx ts-node scripts/backfill-gender-preference.ts
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { Job } from '../src/models/Job';

const PREFS = ['male', 'female', 'any', 'male', 'female'] as const;

async function main(): Promise<void> {
  await mongoose.connect(env.mongodbUri);
  const jobs = await Job.find({ deletedAt: null }).select('_id title genderPreference status');
  let updated = 0;
  for (let i = 0; i < jobs.length; i += 1) {
    const job = jobs[i]!;
    const next = PREFS[i % PREFS.length]!;
    // Keep existing male/female; only rewrite missing/any so demos show badges.
    const current = (job.genderPreference || 'any').toLowerCase();
    if (current === 'male' || current === 'female') continue;
    await Job.updateOne({ _id: job._id }, { $set: { genderPreference: next } });
    updated += 1;
  }
  const after = await Job.aggregate([
    { $match: { deletedAt: null, status: 'published' } },
    { $group: { _id: '$genderPreference', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  console.log({ total: jobs.length, updated, publishedBreakdown: after });
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
