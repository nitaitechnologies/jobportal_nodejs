import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { Candidate } from '../models/Candidate';
import { Job } from '../models/Job';
import { User } from '../models/User';
import type { AuthenticatedEmployer } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import {
  scoreJobMatch,
  type CandidateMatchSource,
  type JobMatchSource,
  type MatchBreakdown,
} from '../utils/matchScore';
import { openAiService } from './openai.service';

export const EMPLOYER_AI_MATCH_LABEL = 'AI-generated';
export const EMPLOYER_AI_MATCH_DISCLAIMER =
  'AI blurbs are produced by ChatGPT from the JD and candidate profile. Scores also use deterministic matching — review before contacting candidates.';

type AiProvenance = {
  aiGenerated: true;
  aiLabel: typeof EMPLOYER_AI_MATCH_LABEL;
  aiDisclaimer: typeof EMPLOYER_AI_MATCH_DISCLAIMER;
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
    aiLabel: EMPLOYER_AI_MATCH_LABEL,
    aiDisclaimer: EMPLOYER_AI_MATCH_DISCLAIMER,
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
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
}): JobMatchSource {
  const location = job.location;
  return {
    title: job.title,
    skills: job.skills,
    requirements: job.requirements,
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    workMode: job.workMode,
    locationText: [location?.address, location?.city, location?.displayName]
      .filter(Boolean)
      .join(' '),
    latitude: typeof location?.latitude === 'number' ? location.latitude : null,
    longitude: typeof location?.longitude === 'number' ? location.longitude : null,
  };
}

function candidateToMatchSource(candidate: {
  headline?: string | null;
  currentJobTitle?: string | null;
  skills?: string[] | null;
  totalExperience?: number | null;
  expectedSalary?: number | null;
  currentLocation?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  openToWork?: boolean | null;
  availableFrom?: Date | null;
  noticePeriod?: number | null;
}): CandidateMatchSource {
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

function serializeMatch(match: MatchBreakdown) {
  return {
    matchPercentage: match.overall,
    overall: match.overall,
    skills: match.skills,
    experience: match.experience,
    location: match.location,
    salary: match.salary,
    availability: match.availability,
    matchingSkills: match.matchingSkills,
    missingSkills: match.missingSkills,
    reasons: match.reasons,
  };
}

export type EmployerJobMatchQuery = {
  minScore?: number;
  limit?: number;
  withAiInsights?: boolean;
};

/**
 * Employer AI Candidate Matching (sheet 243–248).
 * Uses owned job JD to score, explain, and rank public/employers_only candidates.
 */
export class EmployerAiMatchingService {
  private async ownedJob(employer: AuthenticatedEmployer, jobId: string) {
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
    }
    const job = await Job.findOne({
      _id: jobId,
      employerId: employer.employerId,
      companyId: employer.companyId,
      deletedAt: null,
    }).select(
      'title description skills requirements experienceMin experienceMax salaryMin salaryMax workMode location employmentType',
    );
    if (!job) throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
    return job;
  }

  /**
   * Rank candidates against a JD (243–246, 248).
   * Optional ChatGPT blurbs when withAiInsights=true.
   */
  async listMatchesForJob(
    employer: AuthenticatedEmployer,
    jobId: string,
    query: EmployerJobMatchQuery = {},
  ) {
    const job = await this.ownedJob(employer, jobId);
    const minScore = query.minScore ?? 40;
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const withAi = query.withAiInsights === true;

    const candidates = await Candidate.find({
      profileVisibility: { $in: ['public', 'employers_only'] },
    })
      .sort({ updatedAt: -1 })
      .limit(400);

    const users = await User.find({
      _id: { $in: candidates.map((item) => item.userId) },
      role: 'candidate',
      status: 'active',
    }).select('name');
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));
    const jobSource = jobToMatchSource(job);

    const scored = candidates
      .flatMap((candidate) => {
        const user = userMap.get(candidate.userId.toString());
        if (!user) return [];
        const match = scoreJobMatch(jobSource, candidateToMatchSource(candidate));
        if (match.overall < minScore) return [];
        return [
          {
            rank: 0,
            candidateId: candidate._id.toString(),
            name: user.name,
            headline: candidate.headline ?? '',
            currentJobTitle: candidate.currentJobTitle ?? '',
            currentLocation: candidate.currentLocation ?? '',
            totalExperience: candidate.totalExperience ?? 0,
            skills: (candidate.skills ?? []).slice(0, 12),
            openToWork: candidate.openToWork !== false,
            match: serializeMatch(match),
          },
        ];
      })
      .sort((a, b) => b.match.matchPercentage - a.match.matchPercentage)
      .slice(0, limit)
      .map((row, index) => ({ ...row, rank: index + 1 }));

    let aiInsights: Record<string, string> | null = null;
    let model = openAiService.getModel();
    let usedAi = false;

    if (withAi && scored.length > 0 && openAiService.isConfigured()) {
      try {
        const top = scored.slice(0, Math.min(8, scored.length));
        const { content, model: usedModel } = await openAiService.chatJson(
          [
            {
              role: 'system',
              content: `You help Indian employers understand candidate fit for a job. Return JSON only:
{"insights":[{"candidateId":"...","blurb":"1-2 sentences why this candidate fits the JD"}]}
Be factual from provided scores and skills. Never invent employers, employers' company facts, or candidate skills.`,
            },
            {
              role: 'user',
              content: JSON.stringify({
                job: {
                  title: job.title,
                  skills: job.skills ?? [],
                  requirements: (job.requirements ?? []).slice(0, 15),
                  experienceMin: job.experienceMin,
                  experienceMax: job.experienceMax,
                  workMode: job.workMode,
                },
                candidates: top.map((row) => ({
                  candidateId: row.candidateId,
                  name: row.name,
                  headline: row.headline,
                  matchPercentage: row.match.matchPercentage,
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
          insights?: Array<{ candidateId?: string; blurb?: string }>;
        };
        aiInsights = {};
        for (const item of parsed.insights ?? []) {
          if (item.candidateId && item.blurb?.trim()) {
            aiInsights[item.candidateId] = item.blurb.trim();
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
      aiBlurb: aiInsights?.[row.candidateId] ?? null,
      aiGeneratedBlurb: Boolean(aiInsights?.[row.candidateId]),
    }));

    return {
      ...(usedAi
        ? provenance(model, 'AI-assisted candidate matches for this JD — review carefully')
        : {
            aiGenerated: false as const,
            aiLabel: null,
            aiDisclaimer:
              'Match percentages use skills, experience, salary, location, and availability against this job description.',
            provider: 'rules' as const,
            model: null,
            generatedAt: new Date().toISOString(),
            uiHint: {
              showAiBadge: false as const,
              badgeText: '',
              bannerText: 'JD-based candidate ranking',
            },
          }),
      purpose: 'employer_candidate_matching' as const,
      job: {
        id: job._id.toString(),
        title: job.title,
        skills: job.skills ?? [],
      },
      matches,
      total: matches.length,
    };
  }

  /** Explain why a candidate matches this JD (247). */
  async explainMatch(
    employer: AuthenticatedEmployer,
    jobId: string,
    candidateId: string,
  ) {
    const job = await this.ownedJob(employer, jobId);
    if (!mongoose.Types.ObjectId.isValid(candidateId)) {
      throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    }
    const candidate = await Candidate.findOne({
      _id: candidateId,
      profileVisibility: { $in: ['public', 'employers_only'] },
    });
    if (!candidate) throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    const user = await User.findOne({
      _id: candidate.userId,
      role: 'candidate',
      status: 'active',
    }).select('name');
    if (!user) throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);

    const match = scoreJobMatch(jobToMatchSource(job), candidateToMatchSource(candidate));
    const serialized = serializeMatch(match);

    if (!openAiService.isConfigured()) {
      return {
        aiGenerated: false as const,
        aiLabel: null,
        aiDisclaimer: 'Explanation uses deterministic match reasons (AI explain unavailable).',
        provider: 'rules' as const,
        model: null,
        generatedAt: new Date().toISOString(),
        uiHint: {
          showAiBadge: false as const,
          badgeText: '',
          bannerText: 'Match explanation',
        },
        purpose: 'employer_match_explanation' as const,
        job: { id: job._id.toString(), title: job.title },
        candidate: {
          id: candidate._id.toString(),
          name: user.name,
          headline: candidate.headline ?? '',
        },
        match: serialized,
        explanation: {
          summary: match.reasons[0] ?? `Match score ${match.overall}% against this JD.`,
          whyItMatches: match.reasons,
          gapsToImprove: match.missingSkills.slice(0, 8).map((skill) => `Missing skill: ${skill}`),
          nextSteps: [
            match.matchingSkills.length
              ? `Discuss overlapping skills: ${match.matchingSkills.slice(0, 3).join(', ')}`
              : 'Review profile and shortlist if experience fits',
          ],
        },
      };
    }

    const { content, model } = await openAiService.chatJson(
      [
        {
          role: 'system',
          content: `Explain candidate fit for an employer reviewing a JD. Return JSON:
{
  "summary": "2-3 sentences",
  "whyItMatches": ["bullet"],
  "gapsToImprove": ["bullet"],
  "nextSteps": ["bullet"]
}
Use only provided facts. Not a hiring guarantee.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            job: {
              title: job.title,
              description: (job.description ?? '').slice(0, 2500),
              skills: job.skills ?? [],
              requirements: (job.requirements ?? []).slice(0, 20),
              workMode: job.workMode,
              experienceMin: job.experienceMin,
              experienceMax: job.experienceMax,
              salaryMin: job.salaryMin,
              salaryMax: job.salaryMax,
            },
            candidate: {
              name: user.name,
              headline: candidate.headline,
              currentJobTitle: candidate.currentJobTitle,
              skills: candidate.skills ?? [],
              totalExperience: candidate.totalExperience,
              expectedSalary: candidate.expectedSalary,
              currentLocation: candidate.currentLocation,
              openToWork: candidate.openToWork,
              noticePeriod: candidate.noticePeriod,
            },
            match: serialized,
          }),
        },
      ],
      { temperature: 0.4 },
    );

    let explanation: {
      summary: string;
      whyItMatches: string[];
      gapsToImprove: string[];
      nextSteps: string[];
    };
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      explanation = {
        summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
        whyItMatches: Array.isArray(parsed.whyItMatches)
          ? parsed.whyItMatches.filter((x): x is string => typeof x === 'string').slice(0, 8)
          : [],
        gapsToImprove: Array.isArray(parsed.gapsToImprove)
          ? parsed.gapsToImprove.filter((x): x is string => typeof x === 'string').slice(0, 8)
          : [],
        nextSteps: Array.isArray(parsed.nextSteps)
          ? parsed.nextSteps.filter((x): x is string => typeof x === 'string').slice(0, 8)
          : [],
      };
    } catch {
      throw new AppError('AI returned invalid explanation JSON', HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    return {
      ...provenance(model, 'AI explanation of why this candidate matches — review carefully'),
      purpose: 'employer_match_explanation' as const,
      job: { id: job._id.toString(), title: job.title },
      candidate: {
        id: candidate._id.toString(),
        name: user.name,
        headline: candidate.headline ?? '',
      },
      match: serialized,
      explanation,
    };
  }
}

export const employerAiMatchingService = new EmployerAiMatchingService();
