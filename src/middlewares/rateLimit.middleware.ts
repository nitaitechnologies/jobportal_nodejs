import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { HTTP_STATUS } from '../constants';
import { sendError } from '../utils/apiResponse';

/**
 * Auth-sensitive rate limiter (B25).
 * In-memory store — suitable for single-instance deploys.
 * Multi-instance deployments should later use a shared store (e.g. Redis).
 *
 * Mount only on auth login/register routes — not on health or general APIs.
 */
export const authRateLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMs,
  max: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: undefined,
  handler: (_req, res) => {
    sendError(
      res,
      'Too many authentication attempts. Please try again later.',
      HTTP_STATUS.TOO_MANY_REQUESTS,
      [{ path: 'rateLimit', message: 'Rate limit exceeded' }],
    );
  },
  // When TRUST_PROXY=0, default IP handling is used. Set TRUST_PROXY=1 behind a reverse proxy.
  validate: {
    xForwardedForHeader: env.trustProxy > 0,
  },
});

/** AI resume builder / tailor — keeps OpenAI spend bounded per client IP. */
export const aiResumeRateLimiter = rateLimit({
  windowMs: env.aiResumeRateLimitWindowMs,
  max: env.aiResumeRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: undefined,
  handler: (_req, res) => {
    sendError(
      res,
      'Too many AI resume requests. Please try again later.',
      HTTP_STATUS.TOO_MANY_REQUESTS,
      [{ path: 'rateLimit', message: 'AI resume rate limit exceeded' }],
    );
  },
  validate: {
    xForwardedForHeader: env.trustProxy > 0,
  },
});

/** AI matching + career coach. */
export const aiCoachRateLimiter = rateLimit({
  windowMs: env.aiCoachRateLimitWindowMs,
  max: env.aiCoachRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: undefined,
  handler: (_req, res) => {
    sendError(
      res,
      'Too many AI coach requests. Please try again later.',
      HTTP_STATUS.TOO_MANY_REQUESTS,
      [{ path: 'rateLimit', message: 'AI coach rate limit exceeded' }],
    );
  },
  validate: {
    xForwardedForHeader: env.trustProxy > 0,
  },
});

/** Employer AI recruitment assistant + interview questions. */
export const aiRecruitmentRateLimiter = rateLimit({
  windowMs: env.aiRecruitmentRateLimitWindowMs,
  max: env.aiRecruitmentRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: undefined,
  handler: (_req, res) => {
    sendError(
      res,
      'Too many AI recruitment requests. Please try again later.',
      HTTP_STATUS.TOO_MANY_REQUESTS,
      [{ path: 'rateLimit', message: 'AI recruitment rate limit exceeded' }],
    );
  },
  validate: {
    xForwardedForHeader: env.trustProxy > 0,
  },
});
