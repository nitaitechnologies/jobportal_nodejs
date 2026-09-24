import mongoose from 'mongoose';
import type { PublicJobQuery } from '../validators/job.validator';

export type JobSearchFilter = Record<string, unknown>;

/**
 * Strip MongoDB text-operator characters while keeping useful keywords.
 */
export function sanitizeTextSearch(raw: string): string {
  return raw
    .replace(/["\\]/g, ' ')
    .replace(/(^|\s)-+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

/**
 * Experience range overlap:
 * job [experienceMin, experienceMax|∞] overlaps filter [min, max]
 */
export function buildExperienceOverlapFilter(
  experienceMin?: number,
  experienceMax?: number,
): JobSearchFilter | null {
  if (experienceMin === undefined && experienceMax === undefined) {
    return null;
  }

  const clauses: JobSearchFilter[] = [];

  if (experienceMax !== undefined) {
    clauses.push({ experienceMin: { $lte: experienceMax } });
  }

  if (experienceMin !== undefined) {
    clauses.push({
      $or: [
        { experienceMax: { $exists: false } },
        { experienceMax: null },
        { experienceMax: { $gte: experienceMin } },
      ],
    });
  }

  if (clauses.length === 1) {
    return clauses[0];
  }
  return { $and: clauses };
}

/**
 * Salary range overlap on salaryMin/salaryMax.
 */
export function buildSalaryOverlapFilter(
  salaryMin?: number,
  salaryMax?: number,
): JobSearchFilter | null {
  if (salaryMin === undefined && salaryMax === undefined) {
    return null;
  }

  const clauses: JobSearchFilter[] = [];

  if (salaryMax !== undefined) {
    clauses.push({
      $or: [
        { salaryMin: { $exists: false } },
        { salaryMin: null },
        { salaryMin: { $lte: salaryMax } },
      ],
    });
  }

  if (salaryMin !== undefined) {
    clauses.push({
      $or: [
        { salaryMax: { $exists: false } },
        { salaryMax: null },
        { salaryMax: { $gte: salaryMin } },
      ],
    });
  }

  if (clauses.length === 1) {
    return clauses[0];
  }
  return { $and: clauses };
}

export function buildKeywordFilter(keyword: string): JobSearchFilter | null {
  const text = sanitizeTextSearch(keyword);
  if (!text) {
    return null;
  }
  return { $text: { $search: text } };
}

export function resolvePublicSort(
  sort: PublicJobQuery['sort'],
  hasKeyword: boolean,
): Record<string, 1 | -1 | { $meta: 'textScore' }> {
  switch (sort) {
    case 'salary_high':
      return { salaryMax: -1, salaryMin: -1, publishedAt: -1 };
    case 'salary_low':
      return { salaryMin: 1, salaryMax: 1, publishedAt: -1 };
    case 'experience_low':
      return { experienceMin: 1, publishedAt: -1 };
    case 'nearest':
      return { publishedAt: -1 };
    case 'relevance':
      if (hasKeyword) {
        return { score: { $meta: 'textScore' }, featured: -1, urgent: -1, publishedAt: -1 };
      }
      return { featured: -1, urgent: -1, publishedAt: -1, createdAt: -1 };
    case 'latest':
    default:
      return { featured: -1, urgent: -1, publishedAt: -1, createdAt: -1 };
  }
}

export function buildPublicVisibilityFilter(
  companyIds: mongoose.Types.ObjectId[],
  now = new Date(),
): JobSearchFilter {
  return {
    status: 'published',
    deletedAt: null,
    companyId: { $in: companyIds },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const EDUCATION_PATTERNS: Record<string, string[]> = {
  '10th': ['10th', 'tenth', 'class\\s*10', 'matriculate'],
  '12th': ['12th', 'twelfth', 'intermediate', 'class\\s*12', 'hsc', 'higher\\s*secondary'],
  graduate: ['graduate', 'graduation', 'bachelor', 'b\\.?tech', 'bsc', 'bcom', 'ba\\b', 'bba'],
  postgraduate: ['post\\s*grad', 'postgraduate', 'master', 'mba', 'm\\.?tech', 'msc', 'pg\\b'],
};

export function buildEducationFilter(levels?: string[]): JobSearchFilter | null {
  if (!levels?.length) return null;
  const patterns: string[] = [];
  for (const level of levels) {
    const key = level.trim().toLowerCase();
    const aliases = EDUCATION_PATTERNS[key] ?? [escapeRegex(key)];
    patterns.push(...aliases);
  }
  if (!patterns.length) return null;
  return {
    education: { $regex: patterns.join('|'), $options: 'i' },
  };
}

/** Sheet 149–156 Fresher Mode presets for GET /jobs. */
export const FRESHER_MODES = [
  'fresher',
  'internship',
  'no-experience',
  'training',
  'entry-level',
  'graduate',
  '10th',
  '12th',
] as const;
export type FresherMode = (typeof FRESHER_MODES)[number];

const TRAINING_JOB_PATTERN =
  'train(ee|ing|ership)|apprentice|upskill|skill\\s*develop|on[-\\s]?the[-\\s]?job\\s*train';

/**
 * Training / trainee / apprenticeship openings (title or description).
 * Advisory discovery — never returns 404 on empty.
 */
export function buildTrainingJobsFilter(): JobSearchFilter {
  return {
    $or: [
      { title: { $regex: TRAINING_JOB_PATTERN, $options: 'i' } },
      { description: { $regex: TRAINING_JOB_PATTERN, $options: 'i' } },
      { requirements: { $regex: TRAINING_JOB_PATTERN, $options: 'i' } },
    ],
  };
}

export type FresherModeResolved = {
  experienceMin?: number;
  experienceMax?: number;
  employmentType?: string;
  education?: string[];
  extraFilter?: JobSearchFilter | null;
};

/**
 * Resolve fresherMode into search fragments.
 * Explicit query params (experience*, employmentType, education) win when already set.
 */
export function resolveFresherMode(
  mode: FresherMode | undefined,
  current: {
    experienceMin?: number;
    experienceMax?: number;
    employmentType?: string;
    education?: string[];
  },
): FresherModeResolved {
  if (!mode) return {};

  switch (mode) {
    case 'fresher':
    case 'entry-level':
      return {
        experienceMax:
          current.experienceMax !== undefined ? current.experienceMax : 1,
        experienceMin: current.experienceMin,
      };
    case 'no-experience':
      return {
        experienceMax:
          current.experienceMax !== undefined ? current.experienceMax : 0,
        experienceMin: current.experienceMin,
      };
    case 'internship':
      return {
        employmentType: current.employmentType ?? 'internship',
      };
    case 'training':
      return { extraFilter: buildTrainingJobsFilter() };
    case 'graduate':
      return {
        education: current.education?.length ? current.education : ['graduate'],
      };
    case '10th':
      return {
        education: current.education?.length ? current.education : ['10th'],
      };
    case '12th':
      return {
        education: current.education?.length ? current.education : ['12th'],
      };
    default:
      return {};
  }
}

export function buildSkillsFilter(skills?: string[]): JobSearchFilter | null {
  if (!skills?.length) return null;
  return {
    $or: skills.map((skill) => ({
      skills: { $regex: escapeRegex(skill.trim()), $options: 'i' },
    })),
  };
}

export function buildPostedWithinFilter(
  postedWithinDays?: number,
  now = new Date(),
): JobSearchFilter | null {
  if (!postedWithinDays || postedWithinDays < 1) return null;
  const cutoff = new Date(now.getTime() - postedWithinDays * 24 * 60 * 60 * 1000);
  return { publishedAt: { $gte: cutoff } };
}

export function buildWorkingDaysFilter(days?: string[]): JobSearchFilter | null {
  if (!days?.length) return null;
  return { workingDays: { $in: days } };
}

/**
 * Merge filter fragments with `$and` when multiple are present.
 */
export function mergeFilters(...parts: Array<JobSearchFilter | null | undefined>): JobSearchFilter {
  const and: JobSearchFilter[] = [];

  for (const part of parts) {
    if (!part || Object.keys(part).length === 0) {
      continue;
    }
    and.push(part);
  }

  if (and.length === 0) {
    return {};
  }
  if (and.length === 1) {
    return and[0];
  }
  return { $and: and };
}
