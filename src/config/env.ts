import dotenv from 'dotenv';
import path from 'path';

// Prefer explicit ENV_FILE; for NODE_ENV=test also try .env.test (does not override existing vars).
if (process.env.ENV_FILE) {
  dotenv.config({ path: process.env.ENV_FILE });
} else if ((process.env.NODE_ENV ?? 'development') === 'test') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });
}
dotenv.config();

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function parsePositiveInt(key: string, fallback: string): number {
  const raw = requireEnv(key, fallback);
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid integer for ${key}`);
  }
  return value;
}

/** Strip whitespace and trailing slashes so https://app.example.com/ matches the browser Origin. */
function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

const nodeEnv = requireEnv('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';
const jwtSecret = requireEnv('JWT_SECRET');

if (isProduction) {
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  if (
    jwtSecret === 'change-me-to-a-long-random-secret' ||
    jwtSecret.toLowerCase().includes('change-me')
  ) {
    throw new Error('JWT_SECRET must be changed from the example placeholder in production');
  }
}

const clientUrlEarly = normalizeOrigin(
  isProduction ? requireEnv('CLIENT_URL') : requireEnv('CLIENT_URL', 'http://localhost:3000'),
);
const adminClientUrlEarly = normalizeOrigin(process.env.ADMIN_CLIENT_URL ?? '');
const extraCorsOriginsEarly = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

if (isProduction) {
  const corsCandidates = [clientUrlEarly, adminClientUrlEarly, ...extraCorsOriginsEarly].filter(
    Boolean,
  );
  for (const origin of corsCandidates) {
    if (origin.includes('*')) {
      throw new Error(
        'CORS origins must not use wildcards in production (CLIENT_URL, ADMIN_CLIENT_URL, CORS_ORIGINS)',
      );
    }
    if (/(?:localhost|127\.0\.0\.1)/i.test(origin)) {
      throw new Error(
        'CORS origins must not use localhost in production (CLIENT_URL, ADMIN_CLIENT_URL, CORS_ORIGINS)',
      );
    }
  }
}

const storageProvider = requireEnv('STORAGE_PROVIDER', 'local');
const storageLocalRoot = path.resolve(
  requireEnv('STORAGE_LOCAL_ROOT', path.join(process.cwd(), 'storage', 'uploads')),
);

const adminClientUrl = adminClientUrlEarly;
const extraCorsOrigins = extraCorsOriginsEarly;
const mongodbUri = requireEnv('MONGODB_URI');

if (isProduction && /(?:localhost|127\.0\.0\.1)/i.test(mongodbUri)) {
  throw new Error(
    'MONGODB_URI must not point at localhost in production (use Atlas or a reachable host)',
  );
}

/** Local Next.js (3000) + Vite (5173) origins — development only. */
const defaultDevCorsOrigins = isProduction
  ? []
  : [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ];

export const env = {
  nodeEnv,
  port: parsePositiveInt('PORT', '5000'),
  apiPrefix: requireEnv('API_PREFIX', '/api/v1'),
  clientUrl: clientUrlEarly,
  adminClientUrl,
  corsOrigins: [
    clientUrlEarly,
    ...(adminClientUrl ? [adminClientUrl] : []),
    ...extraCorsOrigins,
    ...defaultDevCorsOrigins,
  ].filter((origin, index, arr) => arr.indexOf(origin) === index),
  mongodbUri,
  jwtSecret,
  jwtExpiresIn: requireEnv('JWT_EXPIRES_IN', '1d'),
  storageProvider,
  storageLocalRoot,
  /** Absolute multipart ceiling (bytes). */
  uploadMaxBytes: parsePositiveInt('UPLOAD_MAX_BYTES', String(5 * 1024 * 1024)),
  /** Express trust proxy hop count (0 = disabled). Set 1 behind a single reverse proxy (Render). */
  trustProxy: parseInt(requireEnv('TRUST_PROXY', isProduction ? '1' : '0'), 10),
  authRateLimitWindowMs: parsePositiveInt('AUTH_RATE_LIMIT_WINDOW_MS', String(15 * 60 * 1000)),
  authRateLimitMax: parsePositiveInt('AUTH_RATE_LIMIT_MAX', '20'),
  /**
   * Public base URL for OpenAPI servers (no trailing slash), e.g. https://api.example.com
   * Optional. Localhost is listed only outside production.
   */
  apiPublicUrl: (process.env.API_PUBLIC_URL ?? '').trim(),
  /**
   * Swagger UI + OpenAPI JSON at /api/docs.
   * Default: enabled in non-production; set ENABLE_API_DOCS=true|false to override.
   */
  enableApiDocs:
    process.env.ENABLE_API_DOCS !== undefined
      ? process.env.ENABLE_API_DOCS === 'true' || process.env.ENABLE_API_DOCS === '1'
      : !isProduction,
  /**
   * Video JD / video resume (product). Default off until clients are ready.
   * Exposed on candidate + employer /me as features.videoJdEnabled / videoResumeEnabled.
   */
  enableVideoJd:
    process.env.ENABLE_VIDEO_JD === 'true' || process.env.ENABLE_VIDEO_JD === '1',
  enableVideoResume:
    process.env.ENABLE_VIDEO_RESUME === 'true' || process.env.ENABLE_VIDEO_RESUME === '1',
  /** Max video upload size (bytes). Default 2MB. */
  videoMaxBytes: parsePositiveInt('VIDEO_MAX_BYTES', String(2 * 1024 * 1024)),
  /** Max video duration (seconds). Default 40. */
  videoMaxSeconds: parsePositiveInt('VIDEO_MAX_SECONDS', '40'),
  isDevelopment: nodeEnv === 'development',
  isProduction,
} as const;

export type Env = typeof env;
