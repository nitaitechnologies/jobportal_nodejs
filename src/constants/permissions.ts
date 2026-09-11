import type { AdminRole } from './enums';

/**
 * Permission keys for admin APIs.
 * Enforcement happens via requirePermission middleware.
 */
export const PERMISSIONS = {
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',

  CANDIDATES_READ: 'candidates.read',
  CANDIDATES_UPDATE: 'candidates.update',

  EMPLOYERS_READ: 'employers.read',
  EMPLOYERS_UPDATE: 'employers.update',

  COMPANIES_READ: 'companies.read',
  COMPANIES_UPDATE: 'companies.update',
  COMPANIES_VERIFY: 'companies.verify',

  JOBS_READ: 'jobs.read',
  JOBS_APPROVE: 'jobs.approve',
  JOBS_REJECT: 'jobs.reject',
  JOBS_UPDATE: 'jobs.update',
  JOBS_DELETE: 'jobs.delete',

  APPLICATIONS_READ: 'applications.read',
  APPLICATIONS_UPDATE: 'applications.update',

  INTERVIEWS_READ: 'interviews.read',

  REPORTS_READ: 'reports.read',
  REPORTS_RESOLVE: 'reports.resolve',

  SETTINGS_READ: 'settings.read',
  SETTINGS_CREATE: 'settings.create',
  SETTINGS_UPDATE: 'settings.update',

  CATEGORIES_READ: 'categories.read',
  CATEGORIES_CREATE: 'categories.create',
  CATEGORIES_UPDATE: 'categories.update',
  CATEGORIES_DELETE: 'categories.delete',

  LOCATIONS_READ: 'locations.read',
  LOCATIONS_CREATE: 'locations.create',
  LOCATIONS_UPDATE: 'locations.update',
  LOCATIONS_DELETE: 'locations.delete',

  ARTICLES_READ: 'articles.read',
  ARTICLES_CREATE: 'articles.create',
  ARTICLES_UPDATE: 'articles.update',
  ARTICLES_DELETE: 'articles.delete',
  ARTICLES_PUBLISH: 'articles.publish',

  SUBSCRIPTIONS_READ: 'subscriptions.read',
  SUBSCRIPTIONS_MANAGE: 'subscriptions.manage',
  PLANS_READ: 'plans.read',
  PLANS_CREATE: 'plans.create',
  PLANS_UPDATE: 'plans.update',

  ANALYTICS_READ: 'analytics.read',

  AUDIT_LOGS_READ: 'audit_logs.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

const P = PERMISSIONS;

/** Default permission sets applied when creating/updating admin roles (B22). */
export const ROLE_DEFAULT_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super_admin: [...ALL_PERMISSIONS],
  admin: [
    P.USERS_READ,
    P.USERS_CREATE,
    P.USERS_UPDATE,
    P.CANDIDATES_READ,
    P.CANDIDATES_UPDATE,
    P.EMPLOYERS_READ,
    P.EMPLOYERS_UPDATE,
    P.COMPANIES_READ,
    P.COMPANIES_UPDATE,
    P.COMPANIES_VERIFY,
    P.JOBS_READ,
    P.JOBS_APPROVE,
    P.JOBS_REJECT,
    P.JOBS_UPDATE,
    P.JOBS_DELETE,
    P.APPLICATIONS_READ,
    P.INTERVIEWS_READ,
    P.REPORTS_READ,
    P.REPORTS_RESOLVE,
    P.CATEGORIES_READ,
    P.CATEGORIES_CREATE,
    P.CATEGORIES_UPDATE,
    P.CATEGORIES_DELETE,
    P.LOCATIONS_READ,
    P.LOCATIONS_CREATE,
    P.LOCATIONS_UPDATE,
    P.LOCATIONS_DELETE,
    P.ARTICLES_READ,
    P.ARTICLES_CREATE,
    P.ARTICLES_UPDATE,
    P.ARTICLES_DELETE,
    P.ARTICLES_PUBLISH,
    P.SUBSCRIPTIONS_READ,
    P.SUBSCRIPTIONS_MANAGE,
    P.PLANS_READ,
    P.PLANS_CREATE,
    P.PLANS_UPDATE,
    P.ANALYTICS_READ,
    P.AUDIT_LOGS_READ,
    P.SETTINGS_READ,
    P.SETTINGS_CREATE,
    P.SETTINGS_UPDATE,
  ],
  moderator: [
    P.CANDIDATES_READ,
    P.EMPLOYERS_READ,
    P.COMPANIES_READ,
    P.COMPANIES_UPDATE,
    P.COMPANIES_VERIFY,
    P.JOBS_READ,
    P.JOBS_APPROVE,
    P.JOBS_REJECT,
    P.JOBS_UPDATE,
    P.APPLICATIONS_READ,
    P.INTERVIEWS_READ,
    P.REPORTS_READ,
    P.REPORTS_RESOLVE,
    P.ARTICLES_READ,
    P.ANALYTICS_READ,
  ],
  support: [
    P.USERS_READ,
    P.CANDIDATES_READ,
    P.EMPLOYERS_READ,
    P.COMPANIES_READ,
    P.JOBS_READ,
    P.APPLICATIONS_READ,
    P.INTERVIEWS_READ,
    P.REPORTS_READ,
    P.CATEGORIES_READ,
    P.LOCATIONS_READ,
    P.ARTICLES_READ,
    P.SUBSCRIPTIONS_READ,
    P.PLANS_READ,
    P.ANALYTICS_READ,
    P.SETTINGS_READ,
  ],
};
