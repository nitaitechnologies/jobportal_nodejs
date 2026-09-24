import { env } from '../config/env';

/** Product feature flags from .env — exposed on /me for clients to hide UI. */
export function getFeatureFlags() {
  const hasOpenAi = Boolean(env.openaiApiKey);
  return {
    videoJdEnabled: env.enableVideoJd,
    videoResumeEnabled: env.enableVideoResume,
    videoMaxBytes: env.videoMaxBytes,
    videoMaxSeconds: env.videoMaxSeconds,
    /** AI resume builder + job-specific tailoring (ChatGPT). */
    aiResumeEnabled: env.enableAiResume && hasOpenAi,
    /** Candidate↔job AI matching + explain-why. */
    aiMatchingEnabled: env.enableAiMatching && hasOpenAi,
    /** AI career coach (recommendations, salary, skills). */
    aiCareerCoachEnabled: env.enableAiCareerCoach && hasOpenAi,
    /** Employer AI Recruitment Assistant + AI Interview (ChatGPT). */
    aiRecruitmentEnabled: env.enableAiRecruitment && hasOpenAi,
    /** Candidate↔employer realtime chat (Socket.IO). */
    chatEnabled: env.enableChat,
  } as const;
}

export type FeatureFlags = ReturnType<typeof getFeatureFlags>;
