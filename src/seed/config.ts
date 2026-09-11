/**
 * Development / demo / staging seed configuration.
 * Never run destructive reset against production databases.
 */

import { SeedError } from './errors';

export const SEED_MODE = (process.env.SEED_MODE ?? 'demo') as 'demo';

/** Demo accounts use this email domain for safe identification & reset. */
export const DEMO_EMAIL_DOMAIN = 'workindia.demo';

/**
 * Shared demo password for all seeded accounts.
 * Override with SEED_DEMO_PASSWORD. Dev-only: 8–128 chars (login is length-only).
 * Never log this value.
 */
export const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? '12345678';

/** Analytics / notification metadata marker (no schema change). */
export const SEED_META_FLAG = 'demo' as const;

/** Local storage key prefix for all demo media files. */
export const DEMO_STORAGE_PREFIX = 'demo';

/**
 * Environments where demo seed / verify / reset are allowed.
 * Production is never allowed.
 */
export const ALLOWED_SEED_NODE_ENVS = ['development', 'staging', 'test'] as const;

export type AllowedSeedNodeEnv = (typeof ALLOWED_SEED_NODE_ENVS)[number];

export const SEED_COUNTS = {
  admins: 5,
  candidates: 40,
  employers: 12,
  companies: 12,
  parentCategories: 15,
  subcategories: 40,
  countries: 2,
  states: 12,
  cities: 30,
  areas: 60,
  jobs: 140,
  savedJobs: 110,
  applications: 200,
  interviews: 45,
  notifications: 200,
  careerArticles: 20,
  reports: 20,
  subscriptionPlans: 4,
  subscriptions: 12,
  analyticsEvents: 550,
} as const;

export const FEATURED_JOB_RATIO = 0.12;
export const URGENT_JOB_RATIO = 0.08;

/** Target read ratio for notifications (D2). */
export const NOTIFICATION_READ_RATIO = 0.72;

export function demoEmail(localPart: string): string {
  return `${localPart}@${DEMO_EMAIL_DOMAIN}`.toLowerCase();
}

export function isDemoEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

export function assertDemoPasswordPolicy(): void {
  if (DEMO_PASSWORD.length < 8 || DEMO_PASSWORD.length > 128) {
    throw new SeedError(
      'configuration',
      'Password',
      'SEED_DEMO_PASSWORD must be 8–128 characters',
    );
  }
}

/**
 * Extract host:port from MONGODB_URI without exposing credentials.
 * Returns empty string if the URI cannot be parsed safely.
 */
export function mongodbHostHint(uri: string): string {
  const raw = uri.trim();
  if (!raw) return '';
  const withoutProtocol = raw.replace(/^mongodb(\+srv)?:\/\//i, '');
  const afterAuth = withoutProtocol.includes('@')
    ? withoutProtocol.slice(withoutProtocol.lastIndexOf('@') + 1)
    : withoutProtocol;
  return (afterAuth.split('/')[0] || '').split('?')[0].toLowerCase();
}

function hostLooksProductionLike(host: string): boolean {
  if (!host) return false;
  return (
    /\bprod(uction)?\b/.test(host) ||
    host.includes('-prod.') ||
    host.startsWith('prod.') ||
    host.includes('.prod.')
  );
}

export interface SeedEnvGuardOptions {
  /** When true, requires SEED_ALLOW_RESET=1 (npm run seed:reset sets this). */
  destructive?: boolean;
}

/**
 * Environment + target safety for seed / reset / verify.
 * Does not print MONGODB_URI or credentials.
 */
export function assertSeedEnvironmentAllowed(
  nodeEnv: string,
  options: SeedEnvGuardOptions = {},
): void {
  if (nodeEnv === 'production') {
    throw new SeedError(
      'configuration',
      'Environment',
      'Refusing demo seed/reset/verify when NODE_ENV=production. Use development or staging only.',
    );
  }

  if (!(ALLOWED_SEED_NODE_ENVS as readonly string[]).includes(nodeEnv)) {
    throw new SeedError(
      'configuration',
      'Environment',
      `NODE_ENV="${nodeEnv}" is not allowed for demo seed. Allowed: ${ALLOWED_SEED_NODE_ENVS.join(', ')}.`,
    );
  }

  if (options.destructive && process.env.SEED_ALLOW_RESET !== '1') {
    throw new SeedError(
      'configuration',
      'Reset',
      'Destructive demo reset requires SEED_ALLOW_RESET=1. Use: npm run seed:reset',
    );
  }

  const host = mongodbHostHint(process.env.MONGODB_URI ?? '');
  if (hostLooksProductionLike(host) && process.env.SEED_CONFIRM_TARGET !== 'demo') {
    throw new SeedError(
      'configuration',
      'Database',
      'MongoDB host looks production-like. Refusing demo seed/reset. Set SEED_CONFIRM_TARGET=demo only if this is an intentional non-production demo database.',
    );
  }
}
