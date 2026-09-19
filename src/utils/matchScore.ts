import { haversineKm } from './geo';

export type MatchBreakdown = {
  overall: number;
  skills: number;
  experience: number;
  location: number;
  salary: number;
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
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSkill(value: string): string {
  return value.trim().toLowerCase();
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((token) => token.length > 2);
}

function skillScore(job: JobMatchSource, candidate: CandidateMatchSource): { score: number; reason?: string } {
  const required = Array.from(
    new Set(
      [...(job.skills ?? []), ...(job.requirements ?? [])]
        .map(normalizeSkill)
        .filter((skill) => skill.length > 1 && skill.length <= 40),
    ),
  );
  const owned = new Set((candidate.skills ?? []).map(normalizeSkill).filter(Boolean));
  if (required.length === 0) {
    const titleHits = tokens(job.title ?? '').filter((token) =>
      tokens(`${candidate.headline ?? ''} ${candidate.currentJobTitle ?? ''}`).includes(token),
    );
    if (titleHits.length === 0) return { score: 60 };
    return { score: 80, reason: `Role overlap: ${titleHits.slice(0, 2).join(', ')}` };
  }
  const matched = required.filter((skill) => owned.has(skill));
  const score = clampScore((matched.length / required.length) * 100);
  if (matched.length === 0) return { score };
  return {
    score,
    reason: `Matched skills: ${matched.slice(0, 3).join(', ')}`,
  };
}

function experienceScore(job: JobMatchSource, candidate: CandidateMatchSource): { score: number; reason?: string } {
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

function locationScore(job: JobMatchSource, candidate: CandidateMatchSource): { score: number; reason?: string } {
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

function salaryScore(job: JobMatchSource, candidate: CandidateMatchSource): { score: number; reason?: string } {
  const expected = candidate.expectedSalary;
  if (expected == null || (job.salaryMin == null && job.salaryMax == null)) return { score: 70 };
  const min = job.salaryMin ?? 0;
  const max = job.salaryMax ?? expected;
  if (expected >= min && expected <= max) return { score: 100, reason: 'Salary expectation fits' };
  if (expected < min) return { score: 90 };
  const over = max > 0 ? (expected - max) / max : 1;
  return { score: clampScore(100 - over * 80) };
}

export function scoreJobMatch(job: JobMatchSource, candidate: CandidateMatchSource): MatchBreakdown {
  const skills = skillScore(job, candidate);
  const experience = experienceScore(job, candidate);
  const location = locationScore(job, candidate);
  const salary = salaryScore(job, candidate);
  const overall = clampScore(
    skills.score * 0.45 + experience.score * 0.2 + location.score * 0.2 + salary.score * 0.15,
  );
  return {
    overall,
    skills: skills.score,
    experience: experience.score,
    location: location.score,
    salary: salary.score,
    reasons: [skills.reason, experience.reason, location.reason, salary.reason].filter(
      (reason): reason is string => Boolean(reason),
    ),
  };
}
