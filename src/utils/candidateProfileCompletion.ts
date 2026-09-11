import type { ICandidate } from '../models/Candidate';

export interface ProfileCompletionUserInput {
  name?: string | null;
  phone?: string | null;
  avatar?: string | null;
}

type CandidateLike = Partial<ICandidate> & {
  socialLinks?: {
    linkedin?: string | null;
    twitter?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    github?: string | null;
    website?: string | null;
  } | null;
};

/** Section weights always sum to 100. */
export const PROFILE_SECTION_WEIGHTS = {
  basic_information: 15,
  professional_summary: 10,
  skills: 15,
  work_experience: 15,
  education: 15,
  resume: 15,
  job_preferences: 10,
  additional_information: 5,
} as const;

export type ProfileSectionKey = keyof typeof PROFILE_SECTION_WEIGHTS;

export interface ProfileCompletionDetails {
  percentage: number;
  completedSections: ProfileSectionKey[];
  missingSections: ProfileSectionKey[];
  missingFields: string[];
  sections: Record<
    ProfileSectionKey,
    {
      weight: number;
      completed: boolean;
      missingFields: string[];
    }
  >;
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function hasSocialLink(links: CandidateLike['socialLinks']): boolean {
  if (!links) {
    return false;
  }
  return Object.values(links).some((value) => hasText(value));
}

function isFresher(candidate: CandidateLike): boolean {
  const status = candidate.employmentStatus;
  const experienceYears = candidate.totalExperience ?? 0;
  return (
    !hasItems(candidate.workExperience) &&
    (experienceYears === 0 || status === 'student' || status === 'looking' || status === 'unemployed')
  );
}

function evaluateSections(
  user: ProfileCompletionUserInput,
  candidate: CandidateLike,
): ProfileCompletionDetails['sections'] {
  const basicMissing: string[] = [];
  if (!hasText(user.name)) basicMissing.push('name');
  if (!hasText(user.phone)) basicMissing.push('phone');
  if (!hasText(user.avatar) && !hasText(candidate.profilePhoto)) {
    basicMissing.push('avatar');
  }

  const summaryMissing: string[] = [];
  if (!hasText(candidate.headline)) summaryMissing.push('headline');
  if (!hasText(candidate.bio)) summaryMissing.push('bio');

  const skillsMissing = hasItems(candidate.skills) ? [] : ['skills'];

  const workMissing: string[] = [];
  const fresher = isFresher(candidate);
  const hasWork = hasItems(candidate.workExperience);
  if (!hasWork && !(fresher && hasItems(candidate.education))) {
    workMissing.push('workExperience');
  }

  const educationMissing = hasItems(candidate.education) ? [] : ['education'];
  const resumeMissing = hasText(candidate.resume) ? [] : ['resume'];

  const preferenceMissing: string[] = [];
  if (!hasItems(candidate.preferredLocations)) {
    preferenceMissing.push('preferredLocations');
  }
  if (!candidate.employmentStatus) {
    preferenceMissing.push('employmentStatus');
  }

  const additionalMissing: string[] = [];
  const hasAdditional =
    hasItems(candidate.certifications) ||
    hasItems(candidate.languages) ||
    hasText(candidate.portfolio) ||
    hasSocialLink(candidate.socialLinks);
  if (!hasAdditional) {
    additionalMissing.push('certifications|languages|portfolio|socialLinks');
  }

  return {
    basic_information: {
      weight: PROFILE_SECTION_WEIGHTS.basic_information,
      completed: basicMissing.length === 0,
      missingFields: basicMissing,
    },
    professional_summary: {
      weight: PROFILE_SECTION_WEIGHTS.professional_summary,
      completed: summaryMissing.length === 0,
      missingFields: summaryMissing,
    },
    skills: {
      weight: PROFILE_SECTION_WEIGHTS.skills,
      completed: skillsMissing.length === 0,
      missingFields: skillsMissing,
    },
    work_experience: {
      weight: PROFILE_SECTION_WEIGHTS.work_experience,
      completed: workMissing.length === 0,
      missingFields: workMissing,
    },
    education: {
      weight: PROFILE_SECTION_WEIGHTS.education,
      completed: educationMissing.length === 0,
      missingFields: educationMissing,
    },
    resume: {
      weight: PROFILE_SECTION_WEIGHTS.resume,
      completed: resumeMissing.length === 0,
      missingFields: resumeMissing,
    },
    job_preferences: {
      weight: PROFILE_SECTION_WEIGHTS.job_preferences,
      completed: preferenceMissing.length === 0,
      missingFields: preferenceMissing,
    },
    additional_information: {
      weight: PROFILE_SECTION_WEIGHTS.additional_information,
      completed: additionalMissing.length === 0,
      missingFields: additionalMissing,
    },
  };
}

/**
 * Detailed, server-side profile completion (sections + missing fields).
 */
export function getCandidateProfileCompletionDetails(
  user: ProfileCompletionUserInput,
  candidate: CandidateLike,
): ProfileCompletionDetails {
  const sections = evaluateSections(user, candidate);
  const completedSections = (Object.keys(sections) as ProfileSectionKey[]).filter(
    (key) => sections[key].completed,
  );
  const missingSections = (Object.keys(sections) as ProfileSectionKey[]).filter(
    (key) => !sections[key].completed,
  );

  let percentage = 0;
  for (const key of completedSections) {
    percentage += sections[key].weight;
  }
  percentage = Math.min(100, Math.max(0, percentage));

  const missingFields = missingSections.flatMap((key) => sections[key].missingFields);

  return {
    percentage,
    completedSections,
    missingSections,
    missingFields,
    sections,
  };
}

/**
 * Deterministic candidate profile completion score (0–100).
 * Kept for callers that only need the percentage.
 */
export function calculateCandidateProfileCompletion(
  user: ProfileCompletionUserInput,
  candidate: CandidateLike,
): number {
  return getCandidateProfileCompletionDetails(user, candidate).percentage;
}

/**
 * Minimum bar for applying to jobs (not 100% completion).
 */
export function meetsCandidateApplicationMinimums(
  user: ProfileCompletionUserInput,
  candidate: CandidateLike,
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!hasText(user.name)) missing.push('name');
  if (!hasText(user.phone) && !hasText(user.name)) missing.push('phone');
  if (!hasText(candidate.headline) && !hasItems(candidate.skills)) {
    missing.push('headline_or_skills');
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Approximate years of experience from work history (non-overlapping months / 12).
 */
export function deriveTotalExperienceYears(
  experiences: Array<{
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    isCurrent?: boolean | null;
  }>,
): number {
  const ranges: Array<{ start: number; end: number }> = [];
  const now = Date.now();

  for (const item of experiences) {
    if (!item.startDate) {
      continue;
    }
    const start = new Date(item.startDate).getTime();
    if (Number.isNaN(start)) {
      continue;
    }
    const end = item.isCurrent || !item.endDate ? now : new Date(item.endDate).getTime();
    if (Number.isNaN(end) || end < start) {
      continue;
    }
    ranges.push({ start, end });
  }

  if (ranges.length === 0) {
    return 0;
  }

  ranges.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
    } else {
      last.end = Math.max(last.end, range.end);
    }
  }

  const totalMs = merged.reduce((sum, range) => sum + (range.end - range.start), 0);
  const years = totalMs / (1000 * 60 * 60 * 24 * 365.25);
  return Math.round(years * 10) / 10;
}
