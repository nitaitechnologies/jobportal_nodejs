import { haversineKm } from './geo';

export type MatchBreakdown = {
  /** 0–100 overall match percentage (103). */
  overall: number;
  skills: number;
  experience: number;
  location: number;
  salary: number;
  /** Availability / open-to-work fit (106). */
  availability: number;
  /** Skills present on both sides (104). */
  matchingSkills: string[];
  /** Job skills the candidate is missing (105). */
  missingSkills: string[];
  reasons: string[];
};

export type JobMatchSource = {
  title?: string | null;
  skills?: string[] | null;
  requirements?: string[] | null;
  experienceMin?: number | null;
  experienceMax?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  workMode?: string | null;
  locationText?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type CandidateMatchSource = {
  headline?: string | null;
  currentJobTitle?: string | null;
  skills?: string[] | null;
  totalExperience?: number | null;
  expectedSalary?: number | null;
  currentLocation?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  openToWork?: boolean | null;
  availableFrom?: Date | string | null;
  noticePeriod?: number | null;
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSkill(value: string): string {
  return value.trim().toLowerCase();
}

function displaySkill(value: string): string {
  return value.trim();
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((token) => token.length > 2);
}

function collectRequiredSkills(job: JobMatchSource): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...(job.skills ?? []), ...(job.requirements ?? [])]) {
    const key = normalizeSkill(raw);
    if (key.length <= 1 || key.length > 40 || seen.has(key)) continue;
    seen.add(key);
    out.push(displaySkill(raw));
  }
  return out;
}

function skillScore(job: JobMatchSource, candidate: CandidateMatchSource): {
  score: number;
  reason?: string;
  matchingSkills: string[];
  missingSkills: string[];
} {
  const required = collectRequiredSkills(job);
  const owned = new Set((candidate.skills ?? []).map(normalizeSkill).filter(Boolean));
  if (required.length === 0) {
    const titleHits = tokens(job.title ?? '').filter((token) =>
      tokens(`${candidate.headline ?? ''} ${candidate.currentJobTitle ?? ''}`).includes(token),
    );
    if (titleHits.length === 0) {
      return { score: 60, matchingSkills: [], missingSkills: [] };
    }
    return {
      score: 80,
      reason: `Role overlap: ${titleHits.slice(0, 2).join(', ')}`,
      matchingSkills: titleHits.slice(0, 5),
      missingSkills: [],
    };
  }

  const matchingSkills = required.filter((skill) => owned.has(normalizeSkill(skill)));
  const missingSkills = required.filter((skill) => !owned.has(normalizeSkill(skill)));
  const score = clampScore((matchingSkills.length / required.length) * 100);
  if (matchingSkills.length === 0) {
    return { score, matchingSkills, missingSkills };
  }
  return {
    score,
    reason: `Matched skills: ${matchingSkills.slice(0, 3).join(', ')}`,
    matchingSkills,
    missingSkills,
  };
}

function experienceScore(job: JobMatchSource, candidate: CandidateMatchSource): {
  score: number;
  reason?: string;
} {
  const years = candidate.totalExperience ?? 0;
  const min = job.experienceMin ?? 0;
  const max = job.experienceMax;
  if (years >= min && (max == null || years <= max)) {
    return { score: 100, reason: 'Experience fits this job' };
  }
  if (years < min) {
    const gap = min - years;
    return { score: clampScore(100 - gap * 25) };
  }
  return { score: 75, reason: 'More experience than the posted range' };
}

function locationScore(job: JobMatchSource, candidate: CandidateMatchSource): {
  score: number;
  reason?: string;
} {
  if (job.workMode === 'remote') return { score: 100, reason: 'Remote role' };
  const fromLat = candidate.latitude;
  const fromLng = candidate.longitude;
  const toLat = job.latitude;
  const toLng = job.longitude;
  if (
    typeof fromLat === 'number' &&
    typeof fromLng === 'number' &&
    typeof toLat === 'number' &&
    typeof toLng === 'number'
  ) {
    const km = haversineKm(
      { latitude: fromLat, longitude: fromLng },
      { latitude: toLat, longitude: toLng },
    );
    if (km <= 10) return { score: 100, reason: 'Very close to the office' };
    if (km <= 25) return { score: 85, reason: 'Within commuting distance' };
    if (km <= 50) return { score: 65 };
    return { score: 30 };
  }
  const jobTokens = new Set(tokens(job.locationText ?? ''));
  const candidateTokens = tokens(candidate.currentLocation ?? '');
  if (jobTokens.size === 0 || candidateTokens.length === 0) return { score: 50 };
  const hit = candidateTokens.some((token) => jobTokens.has(token));
  return hit ? { score: 80, reason: 'Same city or area' } : { score: 35 };
}

function salaryScore(job: JobMatchSource, candidate: CandidateMatchSource): {
  score: number;
  reason?: string;
} {
  const expected = candidate.expectedSalary;
  if (expected == null || (job.salaryMin == null && job.salaryMax == null)) return { score: 70 };
  const min = job.salaryMin ?? 0;
  const max = job.salaryMax ?? expected;
  if (expected >= min && expected <= max) return { score: 100, reason: 'Salary expectation fits' };
  if (expected < min) return { score: 90 };
  const over = max > 0 ? (expected - max) / max : 1;
  return { score: clampScore(100 - over * 80) };
}

function availabilityScore(candidate: CandidateMatchSource): { score: number; reason?: string } {
  if (candidate.openToWork === false) {
    return { score: 40, reason: 'Not currently marked available for work' };
  }
  if (candidate.openToWork === true) {
    return { score: 100, reason: 'Open to work / Hire Me' };
  }
  const notice = candidate.noticePeriod;
  if (typeof notice === 'number' && notice <= 30) {
    return { score: 90, reason: 'Short notice period' };
  }
  return { score: 70 };
}

/**
 * Deterministic candidate↔job match (103–106).
 * AI layers (102/107) build on this score and optionally add ChatGPT explanations.
 */
export function scoreJobMatch(job: JobMatchSource, candidate: CandidateMatchSource): MatchBreakdown {
  const skills = skillScore(job, candidate);
  const experience = experienceScore(job, candidate);
  const location = locationScore(job, candidate);
  const salary = salaryScore(job, candidate);
  const availability = availabilityScore(candidate);
  const overall = clampScore(
    skills.score * 0.4 +
      experience.score * 0.18 +
      location.score * 0.17 +
      salary.score * 0.15 +
      availability.score * 0.1,
  );
  return {
    overall,
    skills: skills.score,
    experience: experience.score,
    location: location.score,
    salary: salary.score,
    availability: availability.score,
    matchingSkills: skills.matchingSkills,
    missingSkills: skills.missingSkills,
    reasons: [
      skills.reason,
      experience.reason,
      location.reason,
      salary.reason,
      availability.reason,
    ].filter((reason): reason is string => Boolean(reason)),
  };
}
