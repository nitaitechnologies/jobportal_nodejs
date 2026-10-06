import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { Candidate } from '../models/Candidate';
import { Company } from '../models/Company';
import { Job } from '../models/Job';
import { User } from '../models/User';
import type { AuthenticatedCandidate } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { buildPublicVisibilityFilter } from '../utils/jobSearchQuery';
import {
  scoreJobMatch,
  type CandidateMatchSource,
  type JobMatchSource,
  type MatchBreakdown,
} from '../utils/matchScore';
import { openAiService } from './openai.service';
import { roleAdService } from './roleAd.service';

export const AI_MATCH_LABEL = 'AI-generated';
export const AI_MATCH_DISCLAIMER =
  'Match insights marked AI-generated were produced by ChatGPT. Scores also use your profile data — review before deciding.';

type AiProvenance = {
  aiGenerated: true;
  aiLabel: typeof AI_MATCH_LABEL;
  aiDisclaimer: typeof AI_MATCH_DISCLAIMER;
  provider: 'openai';
  model: string;
  generatedAt: string;
  uiHint: {
    showAiBadge: true;
    badgeText: 'AI-generated';
    bannerText: string;
  };
};

function provenance(model: string, bannerText: string): AiProvenance {
  return {
    aiGenerated: true,
    aiLabel: AI_MATCH_LABEL,
    aiDisclaimer: AI_MATCH_DISCLAIMER,
    provider: 'openai',
    model,
    generatedAt: new Date().toISOString(),
    uiHint: {
      showAiBadge: true,
      badgeText: 'AI-generated',
      bannerText,
    },
  };
}

function jobToMatchSource(job: {
  title?: string;
  skills?: string[] | null;
  requirements?: string[] | null;
  experienceMin?: number | null;
  experienceMax?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  workMode?: string | null;
  location?: {
    displayName?: string;
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
}): JobMatchSource {
  return {
    title: job.title,
    skills: job.skills,
    requirements: job.requirements,
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    workMode: job.workMode,
    locationText: job.location?.displayName || job.location?.city || '',
    latitude: job.location?.latitude,
    longitude: job.location?.longitude,
  };
}

function candidateToMatchSource(
  candidate: InstanceType<typeof Candidate>,
): CandidateMatchSource {
  return {
    headline: candidate.headline,
    currentJobTitle: candidate.currentJobTitle,
    skills: candidate.skills,
    totalExperience: candidate.totalExperience,
    expectedSalary: candidate.expectedSalary,
    currentLocation: candidate.currentLocation,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    openToWork: candidate.openToWork,
    availableFrom: candidate.availableFrom,
    noticePeriod: candidate.noticePeriod,
  };
}

async function loadCandidateDoc(candidate: AuthenticatedCandidate) {
  const [user, candidateDoc] = await Promise.all([
    User.findById(candidate.userId).select('name email phone'),
    Candidate.findById(candidate.candidateId),
  ]);
  if (!user || !candidateDoc) {
    throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
  }
  return { user, candidateDoc };
}

/** Same public company eligibility as GET /jobs. */
async function loadPublicJobsFilter(now = new Date()) {
  const companies = await Company.find({
    status: 'active',
    verificationStatus: { $ne: 'rejected' },
  })
    .select('_id')
    .lean();
  const companyIds = companies.map((c) => c._id);
  if (companyIds.length === 0) return null;
  return buildPublicVisibilityFilter(companyIds, now);
}

function profileSnapshot(
  user: { name?: string },
  candidateDoc: InstanceType<typeof Candidate>,
) {
  return {
    name: user.name ?? '',
    headline: candidateDoc.headline ?? '',
    currentJobTitle: candidateDoc.currentJobTitle ?? '',
    skills: candidateDoc.skills ?? [],
    totalExperience: candidateDoc.totalExperience ?? 0,
    expectedSalary: candidateDoc.expectedSalary ?? null,
    currentLocation: candidateDoc.currentLocation ?? '',
    preferredRoles: candidateDoc.preferredRoles ?? [],
    preferredLocations: candidateDoc.preferredLocations ?? [],
    openToWork: candidateDoc.openToWork ?? true,
    noticePeriod: candidateDoc.noticePeriod ?? 0,
  };
}

export class AiMatchingService {
  /**
   * 102 + 103–106 + 108: rank public jobs for this candidate.
   * Deterministic scores always; optional AI blurbs for the top results.
   */
  async listMatches(
    candidate: AuthenticatedCandidate,
    opts: { limit?: number; minScore?: number; withAiInsights?: boolean },
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
    const minScore = Math.min(Math.max(opts.minScore ?? 40, 0), 100);
    const withAi = opts.withAiInsights !== false;

    const { user, candidateDoc } = await loadCandidateDoc(candidate);
    const candidateSource = candidateToMatchSource(candidateDoc);

    const visibility = await loadPublicJobsFilter();
    if (!visibility) {
      return {
        aiGenerated: false as const,
        aiLabel: null,
        aiDisclaimer:
          'Match percentages are calculated from your profile (skills, experience, location, salary, availability). Enable AI insights for ChatGPT blurbs.',
        provider: 'rules' as const,
        model: null,
        generatedAt: new Date().toISOString(),
        uiHint: {
          showAiBadge: false as const,
          badgeText: '',
          bannerText: 'Profile-based job matches',
        },
        purpose: 'job_matching' as const,
        matches: [],
        total: 0,
        recommendedJobs: [],
      };
    }

    const jobs = await Job.find(visibility)
      .sort({ featured: -1, publishedAt: -1, createdAt: -1 })
      .limit(200)
      .lean();

    const companyIds = [...new Set(jobs.map((j) => j.companyId.toString()))];
    const companies = await Company.find({
      _id: { $in: companyIds.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .select('name slug logo')
      .lean();
    const companyMap = new Map(companies.map((c) => [c._id.toString(), c]));

    const scored = jobs
      .map((job) => {
        const match = scoreJobMatch(jobToMatchSource(job), candidateSource);
        const company = companyMap.get(job.companyId.toString());
        return {
          jobId: job._id.toString(),
          title: job.title,
          slug: job.slug,
          companyName: company?.name ?? 'Company',
          companyLogo: company?.logo ?? '',
          workMode: job.workMode,
          employmentType: job.employmentType,
          location: job.location?.displayName || job.location?.city || '',
          salaryMin: job.salaryMin ?? null,
          salaryMax: job.salaryMax ?? null,
          match,
        };
      })
      .filter((row) => row.match.overall >= minScore)
      .sort((a, b) => b.match.overall - a.match.overall)
      .slice(0, limit);

    let aiInsights: Record<string, string> | null = null;
    let model = openAiService.getModel();
    let usedAi = false;

    if (withAi && scored.length > 0) {
      try {
        const top = scored.slice(0, Math.min(8, scored.length));
        const { content, model: usedModel } = await openAiService.chatJson(
          [
            {
              role: 'system',
              content: `You help Indian job seekers understand job fit. Return JSON only:
{"insights":[{"jobId":"...","blurb":"1-2 sentence why this job fits"}]}
Be factual from the provided profile + job scores. Never invent employers or skills.
Mark tone as helpful coaching, not guaranteed hiring.`,
            },
            {
              role: 'user',
              content: JSON.stringify({
                profile: profileSnapshot(user, candidateDoc),
                jobs: top.map((row) => ({
                  jobId: row.jobId,
                  title: row.title,
                  companyName: row.companyName,
                  matchPercentage: row.match.overall,
                  matchingSkills: row.match.matchingSkills,
                  missingSkills: row.match.missingSkills,
                  reasons: row.match.reasons,
                })),
              }),
            },
          ],
          { temperature: 0.35 },
        );
        model = usedModel;
        const parsed = JSON.parse(content) as {
          insights?: Array<{ jobId?: string; blurb?: string }>;
        };
        aiInsights = {};
        for (const item of parsed.insights ?? []) {
          if (item.jobId && item.blurb?.trim()) {
            aiInsights[item.jobId] = item.blurb.trim();
          }
        }
        usedAi = Object.keys(aiInsights).length > 0;
      } catch {
        aiInsights = null;
        usedAi = false;
      }
    }

    const matches = scored.map((row) => ({
      ...row,
      matchPercentage: row.match.overall,
      matchingSkills: row.match.matchingSkills,
      missingSkills: row.match.missingSkills,
      experienceMatch: row.match.experience,
      salaryMatch: row.match.salary,
      locationMatch: row.match.location,
      availabilityMatch: row.match.availability,
      reasons: row.match.reasons,
      aiBlurb: aiInsights?.[row.jobId] ?? null,
      aiGeneratedBlurb: Boolean(aiInsights?.[row.jobId]),
    }));

    return {
      ...(usedAi
        ? provenance(model, 'AI-assisted job matches — review scores and blurbs carefully')
        : {
            aiGenerated: false as const,
            aiLabel: null,
            aiDisclaimer:
              'Match percentages are calculated from your profile (skills, experience, location, salary, availability). Enable AI insights for ChatGPT blurbs.',
            provider: 'rules' as const,
            model: null,
            generatedAt: new Date().toISOString(),
            uiHint: {
              showAiBadge: false as const,
              badgeText: '',
              bannerText: 'Profile-based job matches',
            },
          }),
      purpose: 'job_matching' as const,
      matches,
      total: matches.length,
      recommendedJobs: matches.slice(0, 6).map((m) => ({
        jobId: m.jobId,
        title: m.title,
        slug: m.slug,
        companyName: m.companyName,
        matchPercentage: m.matchPercentage,
      })),
    };
  }

  /**
   * 107: Explain why a specific job matches (ChatGPT + deterministic breakdown).
   */
  async explainMatch(candidate: AuthenticatedCandidate, jobId: string) {
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
    }

    const { user, candidateDoc } = await loadCandidateDoc(candidate);
    const visibility = await loadPublicJobsFilter();
    const job = visibility
      ? await Job.findOne({ _id: jobId, ...visibility }).lean()
      : null;
    if (!job) {
      throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
    }

    const company = await Company.findById(job.companyId).select('name').lean();
    const match = scoreJobMatch(jobToMatchSource(job), candidateToMatchSource(candidateDoc));

    let explanation: {
      summary: string;
      whyItMatches: string[];
      gapsToImprove: string[];
      nextSteps: string[];
    };
    let model = 'profile';
    let usedAi = false;
    try {
      const result = await openAiService.chatJson(
        [
          {
            role: 'system',
            content: `Explain job fit for a candidate. Return JSON:
{
  "summary": "2-3 sentences",
  "whyItMatches": ["bullet"],
  "gapsToImprove": ["bullet"],
  "nextSteps": ["bullet"]
}
Use only provided facts. Label content as AI coaching, not a hiring guarantee.`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              profile: profileSnapshot(user, candidateDoc),
              job: {
                id: job._id.toString(),
                title: job.title,
                companyName: company?.name ?? 'Company',
                description: (job.description ?? '').slice(0, 2500),
                skills: job.skills ?? [],
                requirements: (job.requirements ?? []).slice(0, 20),
                workMode: job.workMode,
                salaryMin: job.salaryMin,
                salaryMax: job.salaryMax,
              },
              match,
            }),
          },
        ],
        { temperature: 0.4 },
      );
      const parsed = JSON.parse(result.content) as Record<string, unknown>;
      model = result.model;
      usedAi = true;
      explanation = {
        summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
        whyItMatches: Array.isArray(parsed.whyItMatches)
          ? parsed.whyItMatches.filter((item): item is string => typeof item === 'string').slice(0, 8)
          : [],
        gapsToImprove: Array.isArray(parsed.gapsToImprove)
          ? parsed.gapsToImprove.filter((item): item is string => typeof item === 'string').slice(0, 8)
          : [],
        nextSteps: Array.isArray(parsed.nextSteps)
          ? parsed.nextSteps.filter((item): item is string => typeof item === 'string').slice(0, 8)
          : [],
      };
    } catch {
      const missing = match.missingSkills ?? [];
      explanation = {
        summary: `${job.title} is a ${match.overall}% match with your profile.`,
        whyItMatches: match.reasons.slice(0, 6),
        gapsToImprove: missing.slice(0, 6).map((skill) => `Build ${skill} — this job asks for it.`),
        nextSteps: missing.length
          ? [`Learn ${missing.slice(0, 2).join(' and ')}, then add them to your profile.`]
          : ['Your skills already cover this job. Apply if the role fits.'],
      };
    }

    let sponsoredAds: Awaited<ReturnType<typeof roleAdService.findLiveForSkills>> = [];
    try {
      sponsoredAds = await roleAdService.findLiveForSkills([
        ...(match.missingSkills ?? []),
        job.title,
      ]);
    } catch {
      sponsoredAds = [];
    }

    return {
      ...(usedAi
        ? provenance(model, 'AI explanation of why this job matches — review carefully')
        : {
            aiGenerated: false as const,
            aiLabel: 'Profile match',
            aiDisclaimer: 'Based on your profile and this job. Review before you apply.',
            provider: 'rules' as const,
            model: null,
            generatedAt: new Date().toISOString(),
            uiHint: {
              showAiBadge: false as const,
              badgeText: '',
              bannerText: 'Profile match',
            },
          }),
      purpose: 'match_explanation' as const,
      job: {
        id: job._id.toString(),
        title: job.title,
        slug: job.slug,
        companyName: company?.name ?? 'Company',
      },
      match: {
        matchPercentage: match.overall,
        matchingSkills: match.matchingSkills,
        missingSkills: match.missingSkills,
        experienceMatch: match.experience,
        salaryMatch: match.salary,
        locationMatch: match.location,
        availabilityMatch: match.availability,
        reasons: match.reasons,
      } satisfies Partial<MatchBreakdown> & Record<string, unknown>,
      explanation,
      sponsoredAds,
    };
  }
}

export const aiMatchingService = new AiMatchingService();
