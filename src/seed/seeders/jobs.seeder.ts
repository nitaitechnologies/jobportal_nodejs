import { Job } from '../../models/Job';
import type { EmploymentType, JobStatus, WorkMode } from '../../constants/enums';
import { slugify } from '../../utils/slug';
import {
  FEATURED_JOB_RATIO,
  SEED_COUNTS,
  URGENT_JOB_RATIO,
} from '../config';
import {
  BENEFITS_POOL,
  JOB_TITLE_POOL,
  REQUIREMENTS,
  RESPONSIBILITIES,
  jobDescription,
} from '../data/jobs';
import {
  EXPERIENCE_BANDS,
  PRIORITY_CITY_NAMES,
  TITLE_TO_CATEGORY_SLUG,
} from '../data/personas';
import { daysAgo, daysFromNow } from '../helpers/dates';
import { chance, createSeededRng, intBetween, pick, pickN } from '../helpers/rng';
import type { SeedCategoryNode, SeedContext, SeedLocationNode } from '../types';

/** ~60% published, remainder across other B11 statuses. */
function buildStatusList(total: number): JobStatus[] {
  const published = Math.round(total * 0.62);
  const draft = Math.round(total * 0.11);
  const paused = Math.round(total * 0.07);
  const closed = Math.round(total * 0.07);
  const pending = Math.round(total * 0.05);
  const rejected = Math.round(total * 0.04);
  let expired = total - published - draft - paused - closed - pending - rejected;
  if (expired < 0) expired = 0;

  const list: JobStatus[] = [
    ...Array(published).fill('published'),
    ...Array(draft).fill('draft'),
    ...Array(paused).fill('paused'),
    ...Array(closed).fill('closed'),
    ...Array(pending).fill('pending'),
    ...Array(rejected).fill('rejected'),
    ...Array(expired).fill('expired'),
  ] as JobStatus[];

  while (list.length < total) list.push('published');
  return list.slice(0, total);
}

function resolveCategory(
  title: string,
  ctx: SeedContext,
  fallbackIndex: number,
): SeedCategoryNode {
  const slug = TITLE_TO_CATEGORY_SLUG[title];
  if (slug) {
    const found = ctx.subcategories.find((c) => c.slug === slug) ?? ctx.categories.find((c) => c.slug === slug);
    if (found) return found;
  }
  return ctx.subcategories[fallbackIndex % Math.max(ctx.subcategories.length, 1)]
    ?? ctx.categories[fallbackIndex % ctx.categories.length]!;
}

function pickLocation(ctx: SeedContext, index: number, rng: () => number): SeedLocationNode {
  const priorityAreas = ctx.areas.filter((a) =>
    (PRIORITY_CITY_NAMES as readonly string[]).includes(a.cityName ?? ''),
  );
  const pool = priorityAreas.length > 0 ? priorityAreas : ctx.areas.length > 0 ? ctx.areas : ctx.cities;
  // Bias ~70% to priority metros
  if (priorityAreas.length > 0 && rng() < 0.7) {
    return priorityAreas[index % priorityAreas.length]!;
  }
  return pool[index % pool.length]!;
}

function skillsForTitle(title: string, rng: () => number): string[] {
  const base = [
    'Communication',
    'Problem Solving',
    'Teamwork',
    'MS Excel',
  ];
  const byTitle: Record<string, string[]> = {
    'Frontend Developer': ['React', 'TypeScript', 'CSS', 'HTML'],
    'React Developer': ['React', 'Redux', 'TypeScript', 'Next.js'],
    'Backend Developer': ['Node.js', 'MongoDB', 'REST APIs', 'SQL'],
    'Node.js Developer': ['Node.js', 'Express', 'MongoDB', 'TypeScript'],
    'Laravel Developer': ['Laravel', 'PHP', 'MySQL', 'REST APIs'],
    'Flutter Developer': ['Flutter', 'Dart', 'Firebase', 'REST APIs'],
    'DevOps Engineer': ['AWS', 'Docker', 'CI/CD', 'Linux'],
    'QA Engineer': ['Manual Testing', 'Selenium', 'API Testing'],
    'Data Analyst': ['SQL', 'Python', 'Tableau', 'Excel'],
    'UI/UX Designer': ['Figma', 'Wireframing', 'Prototyping'],
    'SEO Executive': ['SEO', 'Ahrefs', 'Content Strategy'],
    'Digital Marketing Manager': ['Google Ads', 'Meta Ads', 'Analytics'],
    'Sales Executive': ['CRM', 'Lead Generation', 'Negotiation'],
    Accountant: ['Tally', 'GST', 'Bookkeeping'],
  };
  const specific = byTitle[title] ?? ['Domain Knowledge', 'Ownership'];
  return pickN(rng, [...specific, ...base], intBetween(rng, 3, 6));
}

/**
 * Assign job counts per employer for marketplace variety.
 * Index 0 busy, 1 drafts-only, 2 featured-heavy, last quiet (0–1), rest normal.
 */
function allocateJobSlots(employerCount: number, totalJobs: number): number[] {
  const slots = Array(employerCount).fill(0) as number[];
  if (employerCount === 0) return slots;

  slots[0] = Math.min(22, Math.max(16, Math.floor(totalJobs * 0.16))); // busy
  if (employerCount > 1) slots[1] = 3; // drafts-only new employer
  if (employerCount > 2) slots[2] = Math.min(16, Math.max(10, Math.floor(totalJobs * 0.12))); // featured
  if (employerCount > 3) slots[employerCount - 1] = 0; // quiet / no jobs yet

  let assigned = slots.reduce((a, b) => a + b, 0);
  const remainingEmployers = [];
  for (let i = 0; i < employerCount; i += 1) {
    if (i !== 0 && i !== 1 && i !== 2 && i !== employerCount - 1) {
      remainingEmployers.push(i);
    }
  }
  let left = totalJobs - assigned;
  if (left < 0) {
    slots[0] = Math.max(0, slots[0]! + left);
    left = totalJobs - slots.reduce((a, b) => a + b, 0);
  }
  const per = remainingEmployers.length > 0 ? Math.floor(left / remainingEmployers.length) : 0;
  for (const idx of remainingEmployers) {
    slots[idx] = per;
  }
  let leftover = totalJobs - slots.reduce((a, b) => a + b, 0);
  let cursor = 0;
  while (leftover > 0 && remainingEmployers.length > 0) {
    const idx = remainingEmployers[cursor % remainingEmployers.length]!;
    slots[idx] = (slots[idx] ?? 0) + 1;
    leftover -= 1;
    cursor += 1;
  }
  // If still leftover (few employers), dump on busy
  if (leftover > 0) slots[0] = (slots[0] ?? 0) + leftover;

  return slots;
}

export async function seedJobs(ctx: SeedContext): Promise<void> {
  const rng = createSeededRng(77);
  const total = SEED_COUNTS.jobs;
  const statuses = buildStatusList(total);
  const slots = allocateJobSlots(ctx.employers.length, total);

  // Build employer queue repeating by allocated slots
  const employerQueue: number[] = [];
  for (let ei = 0; ei < slots.length; ei += 1) {
    for (let n = 0; n < (slots[ei] ?? 0); n += 1) {
      employerQueue.push(ei);
    }
  }
  while (employerQueue.length < total) employerQueue.push(0);

  let jobIndex = 0;
  for (let i = 0; i < total; i += 1) {
    const employerIdx = employerQueue[i]!;
    const employer = ctx.employers[employerIdx]!;
    const title = JOB_TITLE_POOL[i % JOB_TITLE_POOL.length]!;
    const slug = slugify(`${title}-${employer.companySlug}-${i + 1}`);
    const category = resolveCategory(title, ctx, i);
    const area = pickLocation(ctx, i, rng);
    const band = EXPERIENCE_BANDS[i % EXPERIENCE_BANDS.length]!;

    let status = statuses[i]!;
    // Employer B (index 1): force drafts
    if (employerIdx === 1) {
      status = 'draft';
    }
    // Quiet employer should not get published spam (already 0 slots)
    // Employer C (index 2): prefer published
    if (employerIdx === 2 && status === 'draft') {
      status = 'published';
    }

    const workMode = (['onsite', 'hybrid', 'remote'] as WorkMode[])[i % 3]!;
    const employmentType = (
      ['full-time', 'full-time', 'full-time', 'contract', 'internship', 'part-time', 'temporary'] as EmploymentType[]
    )[i % 7]!;

    const salaryMin =
      band.salaryMin[0] + Math.floor(rng() * (band.salaryMin[1] - band.salaryMin[0]));
    const salaryMax =
      salaryMin +
      band.salaryMaxExtra[0] +
      Math.floor(rng() * (band.salaryMaxExtra[1] - band.salaryMaxExtra[0]));

    let featured = chance(rng, FEATURED_JOB_RATIO) && status === 'published';
    let urgent = chance(rng, URGENT_JOB_RATIO) && status === 'published';
    if (employerIdx === 2 && status === 'published') {
      featured = featured || chance(rng, 0.35);
      urgent = urgent || chance(rng, 0.2);
    }

    const publishedAt =
      status === 'published' || status === 'paused' || status === 'closed' || status === 'expired'
        ? daysAgo(intBetween(rng, 1, 60))
        : undefined;
    const expiresAt =
      status === 'expired'
        ? daysAgo(intBetween(rng, 1, 10))
        : status === 'published'
          ? daysFromNow(intBetween(rng, 7, 45))
          : undefined;

    const job = await Job.findOneAndUpdate(
      { slug },
      {
        $set: {
          companyId: employer.companyId,
          employerId: employer.employerId,
          title,
          slug,
          description: jobDescription(title, employer.companyName),
          responsibilities: [...RESPONSIBILITIES],
          requirements: [
            ...REQUIREMENTS,
            `Experience: ${band.band === 'fresher' ? 'Fresher' : `${band.min}–${band.max} years`}`,
          ],
          skills: skillsForTitle(title, rng),
          categoryId: category.id,
          location: {
            locationId: area.id,
            city: area.cityName ?? area.name,
            state: area.stateName ?? '',
            country: area.countryName ?? 'India',
            area: area.type === 'area' ? area.name : '',
            displayName: area.displayName ?? area.name,
          },
          workMode,
          employmentType,
          experienceMin: band.min,
          experienceMax: band.max,
          salaryMin,
          salaryMax,
          salaryPeriod: 'monthly',
          openings: intBetween(rng, 1, 5),
          education: pick(rng, ['Any Graduate', 'B.Tech / B.E.', 'MBA', 'B.Com', '']),
          genderPreference: 'any',
          benefits: pickN(rng, BENEFITS_POOL, intBetween(rng, 2, 5)),
          applicationDeadline:
            status === 'published' ? daysFromNow(intBetween(rng, 5, 40)) : undefined,
          applicationMethod: 'platform',
          status,
          featured,
          urgent,
          views: status === 'published' ? intBetween(rng, 40, 900) : intBetween(rng, 0, 40),
          applicationsCount: 0,
          publishedAt,
          expiresAt,
        },
        $unset: { deletedAt: 1 },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    const ref = {
      jobId: job._id,
      slug: job.slug,
      title: job.title,
      status: job.status,
      companyId: employer.companyId,
      employerId: employer.employerId,
      categoryId: category.id,
    };
    ctx.jobs.push(ref);
    if (status === 'published') {
      ctx.publishedJobs.push(ref);
    }
    jobIndex += 1;
  }

  void jobIndex;
  ctx.summary.jobs = ctx.jobs.length;
}
