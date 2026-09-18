import { env } from '../config/env';

/** Product feature flags from .env — exposed on /me for clients to hide UI. */
export function getFeatureFlags() {
  return {
    videoJdEnabled: env.enableVideoJd,
    videoResumeEnabled: env.enableVideoResume,
    videoMaxBytes: env.videoMaxBytes,
    videoMaxSeconds: env.videoMaxSeconds,
  } as const;
}

export type FeatureFlags = ReturnType<typeof getFeatureFlags>;
