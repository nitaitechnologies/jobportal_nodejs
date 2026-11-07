import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { Application } from '../src/models/Application';
import { Job } from '../src/models/Job';

const PREFS = ['any', 'any', 'male', 'female', 'any'] as const;

async function main(): Promise<void> {
  await mongoose.connect(env.mongodbUri);
  const jobs = await Job.find({ deletedAt: null, status: 'published' }).select(
    '_id applicationsCount genderPreference',
  );
  let genderNonAny = 0;
  for (let i = 0; i < jobs.length; i += 1) {
    const job = jobs[i]!;
    const pref = PREFS[i % PREFS.length]!;
    const appCount = await Application.countDocuments({ jobId: job._id });
    const nextCount = appCount > 0 ? appCount : 8 + (i % 37);
    await Job.updateOne(
      { _id: job._id },
      { $set: { genderPreference: pref, applicationsCount: nextCount } },
    );
    if (pref !== 'any') genderNonAny += 1;
  }
  console.log({ jobs: jobs.length, genderNonAny });
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
