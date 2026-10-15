import mongoose from 'mongoose';
import { Application } from '../models/Application';
import { Job } from '../models/Job';

const MATCH_STOP_WORDS = new Set([
  'and',
  'the',
  'for',
  'with',
  'from',
  'this',
  'that',
  'job',
  'role',
  'years',
  'year',
  'per',
  'month',
  'good',
  'strong',
  'excellent',
  'must',
  'have',
  'using',
  'ability',
  'required',
  'preferred',
  'candidate',
  'working',
  'work',
  'skills',
  'skill',
]);

function escapeMatchText(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function jobKeywordNeedles(title?: string | null, skills?: string[] | null) {
  const terms = [title, ...(skills ?? [])].filter(
    (term): term is string => Boolean(term && term.trim().length > 1),
  );
  const needles = new Set<string>();
  for (const term of terms) {
    const words = term
      .trim()
      .split(/[^a-z0-9+#]+/i)
      .filter((word) => word.length > 2 && !MATCH_STOP_WORDS.has(word.toLowerCase()));
    if (words.length >= 2) needles.add(words.join(' '));
    for (const word of words) needles.add(word);
  }
  return [...needles].sort((left, right) => right.length - left.length);
}

function textHitsKeywords(text: string, needles: string[]) {
  if (!text || needles.length === 0) return false;
  const pattern = new RegExp(
    `(?<![a-z0-9+#])(?:${needles.map(escapeMatchText).join('|')})(?![a-z0-9+#])`,
    'i',
  );
  return pattern.test(text);
}

/** How many other jobs, similar to this one, each candidate has applied to. */
export async function countSimilarJobApplications(
  job: { _id: mongoose.Types.ObjectId; title?: string | null; skills?: string[] | null },
  candidateIds: string[],
) {
  const counts = new Map<string, number>();
  const ids = [...new Set(candidateIds.filter((id) => mongoose.Types.ObjectId.isValid(id)))];
  for (const id of ids) counts.set(id, 0);
  if (!ids.length) return counts;

  const needles = jobKeywordNeedles(job.title, null);
  if (!needles.length) return counts;

  const applications = await Application.find({
    candidateId: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
    jobId: { $ne: job._id },
  })
    .select('candidateId jobId')
    .lean<Array<{ candidateId: mongoose.Types.ObjectId; jobId: mongoose.Types.ObjectId }>>();

  const jobIds = [...new Set(applications.map((item) => item.jobId.toString()))];
  if (!jobIds.length) return counts;

  const jobs = await Job.find({
    _id: { $in: jobIds },
    deletedAt: null,
  })
    .select('title skills')
    .lean<Array<{ _id: mongoose.Types.ObjectId; title?: string | null; skills?: string[] | null }>>();

  const similar = new Set<string>();
  for (const other of jobs) {
    const blob = other.title ?? '';
    if (textHitsKeywords(blob, needles)) similar.add(other._id.toString());
  }

  for (const application of applications) {
    if (!similar.has(application.jobId.toString())) continue;
    const key = application.candidateId.toString();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
