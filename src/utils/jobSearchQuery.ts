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
    case 'relevance':
      if (hasKeyword) {
        return { score: { $meta: 'textScore' }, publishedAt: -1 };
      }
      return { publishedAt: -1, createdAt: -1 };
    case 'latest':
    default:
      return { publishedAt: -1, createdAt: -1 };
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
