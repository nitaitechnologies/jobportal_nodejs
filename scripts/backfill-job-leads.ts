/**
 * Give every live job responses and shortlisted hot leads for employer testing.
 * Does not reset other data. Usage: npx ts-node scripts/backfill-job-leads.ts
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { Application } from '../src/models/Application';
import { Candidate } from '../src/models/Candidate';
import { Job } from '../src/models/Job';

const MIN_RESPONSES = 8;
const MIN_LEADS = 3;

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

async function main(): Promise<void> {
  await mongoose.connect(env.mongodbUri);
  const candidates = await Candidate.find({}).select('_id').lean();
  if (!candidates.length) {
    throw new Error('No candidates in the database to attach as leads.');
  }

  const jobs = await Job.find({ deletedAt: null, status: { $in: ['published', 'paused'] } }).select(
    '_id title employerId companyId',
  );

  let created = 0;
  let promoted = 0;

  for (const job of jobs) {
    const existing = await Application.find({ jobId: job._id }).select('_id candidateId status');
    const used = new Set(existing.map((row) => row.candidateId.toString()));
    let leads = existing.filter((row) => row.status === 'shortlisted').length;

    if (leads < MIN_LEADS) {
      const promotable = existing.filter((row) => row.status === 'applied' || row.status === 'viewed');
      for (const row of promotable) {
        if (leads >= MIN_LEADS) break;
        await Application.updateOne(
          { _id: row._id },
          { $set: { status: 'shortlisted', shortlistedAt: daysAgo(2), viewedAt: daysAgo(4) } },
        );
        leads += 1;
        promoted += 1;
      }
    }

    const pool = candidates.filter((candidate) => !used.has(candidate._id.toString()));
    let cursor = 0;
    while (existing.length + cursor < MIN_RESPONSES && cursor < pool.length) {
      const candidate = pool[cursor]!;
      const asLead = leads < MIN_LEADS;
      const status = asLead ? 'shortlisted' : cursor % 3 === 0 ? 'viewed' : 'applied';
      await Application.create({
        candidateId: candidate._id,
        jobId: job._id,
        employerId: job.employerId,
        companyId: job.companyId,
        coverLetter: `Applying for ${job.title}.`,
        status,
        appliedAt: daysAgo(3 + (cursor % 20)),
        viewedAt: status === 'applied' ? undefined : daysAgo(2),
        shortlistedAt: asLead ? daysAgo(1) : undefined,
        source: 'platform',
      });
      if (asLead) leads += 1;
      cursor += 1;
      created += 1;
    }

    const count = await Application.countDocuments({ jobId: job._id });
    await Job.updateOne({ _id: job._id }, { $set: { applicationsCount: count } });
    console.log(`${job.title}: ${count} responses, ${leads} hot leads`);
  }

  console.log(`created ${created}, promoted ${promoted}, jobs ${jobs.length}, candidates ${candidates.length}`);
  await mongoose.disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
