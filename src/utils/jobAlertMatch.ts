import mongoose from 'mongoose';
import {
  buildExperienceOverlapFilter,
  buildKeywordFilter,
  buildSalaryOverlapFilter,
  buildSkillsFilter,
  mergeFilters,
  type JobSearchFilter,
} from './jobSearchQuery';
import { haversineKm } from './geo';
import type { SavedSearchFiltersInput } from '../validators/savedSearch.validator';

/** Category slug / title cues for government & exam roles (082). */
export const GOVERNMENT_PATTERN =
  /government|govt|sarkari|public[\s-]?sector|psc|ssc|upsc|exam|civil[\s-]?service|railway|defence|defense/i;

export function looksLikeGovernmentJob(input: {
  title?: string | null;
  description?: string | null;
  categorySlug?: string | null;
  categoryName?: string | null;
}): boolean {
  const hay = [input.title, input.description, input.categorySlug, input.categoryName]
    .filter(Boolean)
    .join(' ');
  return GOVERNMENT_PATTERN.test(hay);
}

export function buildSavedSearchMongoFilter(
  filters: Partial<SavedSearchFiltersInput> | Record<string, unknown> | null | undefined,
  opts?: { companyIds?: mongoose.Types.ObjectId[]; now?: Date },
): JobSearchFilter {
  const f = (filters ?? {}) as Partial<SavedSearchFiltersInput>;
  const now = opts?.now ?? new Date();

  const visibility: JobSearchFilter = {
    status: 'published',
    deletedAt: null,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };
  if (opts?.companyIds?.length) {
    visibility.companyId = { $in: opts.companyIds };
  }

  return mergeFilters(
    visibility,
    f.q ? buildKeywordFilter(f.q) : null,
    f.categoryId && mongoose.Types.ObjectId.isValid(String(f.categoryId))
      ? { categoryId: new mongoose.Types.ObjectId(String(f.categoryId)) }
      : null,
    f.locationId && mongoose.Types.ObjectId.isValid(String(f.locationId))
      ? { 'location.locationId': new mongoose.Types.ObjectId(String(f.locationId)) }
      : null,
    f.workMode ? { workMode: f.workMode } : null,
    f.employmentType ? { employmentType: f.employmentType } : null,
    buildExperienceOverlapFilter(f.experienceMin, f.experienceMax),
    buildSalaryOverlapFilter(f.salaryMin, f.salaryMax),
    f.featured === undefined ? null : { featured: f.featured },
    f.urgent === undefined ? null : { urgent: f.urgent },
    buildSkillsFilter(f.skills),
  );
}

export function jobMatchesSavedSearchFilters(
  job: {
    title?: string | null;
    description?: string | null;
    categoryId?: { toString(): string } | null;
    location?: {
      locationId?: { toString(): string } | null;
      latitude?: number | null;
      longitude?: number | null;
    } | null;
    workMode?: string | null;
    employmentType?: string | null;
    experienceMin?: number | null;
    experienceMax?: number | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    featured?: boolean | null;
    urgent?: boolean | null;
    skills?: string[] | null;
  },
  filters: Partial<SavedSearchFiltersInput> | Record<string, unknown> | null | undefined,
  categoryMeta?: { slug?: string; name?: string } | null,
): boolean {
  const f = (filters ?? {}) as Partial<SavedSearchFiltersInput>;

  if (f.categoryId && job.categoryId?.toString() !== String(f.categoryId)) return false;
  if (
    f.locationId &&
    job.location?.locationId?.toString() !== String(f.locationId)
  ) {
    return false;
  }
  if (f.workMode && job.workMode !== f.workMode) return false;
  if (f.employmentType && job.employmentType !== f.employmentType) return false;
  if (f.featured === true && !job.featured) return false;
  if (f.urgent === true && !job.urgent) return false;

  if (f.experienceMin !== undefined || f.experienceMax !== undefined) {
    const jobMin = job.experienceMin ?? 0;
    const jobMax = job.experienceMax ?? 99;
    const filterMin = f.experienceMin ?? 0;
    const filterMax = f.experienceMax ?? 99;
    if (jobMin > filterMax || jobMax < filterMin) return false;
  }

  if (f.salaryMin !== undefined || f.salaryMax !== undefined) {
    const jobMin = job.salaryMin ?? 0;
    const jobMax = job.salaryMax ?? Number.MAX_SAFE_INTEGER;
    const filterMin = f.salaryMin ?? 0;
    const filterMax = f.salaryMax ?? Number.MAX_SAFE_INTEGER;
    if (jobMin > filterMax || jobMax < filterMin) return false;
  }

  if (f.skills?.length) {
    const jobSkills = (job.skills ?? []).map((s) => s.toLowerCase());
    const hit = f.skills.some((skill) =>
      jobSkills.some((js) => js.includes(skill.toLowerCase())),
    );
    if (!hit) return false;
  }

  if (f.q?.trim()) {
    const needle = f.q.trim().toLowerCase();
    const hay = `${job.title ?? ''} ${job.description ?? ''}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }

  if (f.government === true) {
    if (
      !looksLikeGovernmentJob({
        title: job.title,
        description: job.description,
        categorySlug: categoryMeta?.slug,
        categoryName: categoryMeta?.name,
      })
    ) {
      return false;
    }
  }

  if (
    typeof f.lat === 'number' &&
    typeof f.lng === 'number' &&
    typeof f.radiusKm === 'number'
  ) {
    const lat = job.location?.latitude;
    const lng = job.location?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    if (haversineKm({ latitude: f.lat, longitude: f.lng }, { latitude: lat, longitude: lng }) > f.radiusKm) {
      return false;
    }
  }

  return true;
}

export function isDigestDue(
  frequency: string,
  lastAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (frequency === 'off' || frequency === 'instant') return false;
  if (!lastAt) return true;
  const elapsedMs = now.getTime() - lastAt.getTime();
  if (frequency === 'daily') return elapsedMs >= 23 * 60 * 60 * 1000;
  if (frequency === 'weekly') return elapsedMs >= 6.5 * 24 * 60 * 60 * 1000;
  return false;
}
