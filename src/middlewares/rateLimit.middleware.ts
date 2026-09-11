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
