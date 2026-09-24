import type { SettingValueType } from './enums';

export const SETTING_GROUPS = [
  'general',
  'jobs',
  'applications',
  'notifications',
  'candidate',
  'employer',
  'subscriptions',
  'uploads',
  'seo',
  'analytics',
  'maintenance',
] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number];

/** Namespaces that must never be created/edited via ordinary admin settings APIs. */
export const PROTECTED_SETTING_PREFIXES = [
  'auth.',
  'security.',
  'database.',
  'storage.credentials.',
  'payment.credentials.',
  'internal.',
  'jwt.',
  'mongodb.',
] as const;

export interface DefaultPlatformSetting {
  key: string;
  value: unknown;
  type: SettingValueType;
  group: SettingGroup;
  description: string;
  isPublic: boolean;
  isActive: boolean;
  isEditable: boolean;
}

/**
 * Application defaults. ensureDefaultSettings() inserts missing keys only —
 * never overwrites admin-modified values.
 */
export const DEFAULT_PLATFORM_SETTINGS: readonly DefaultPlatformSetting[] = [
  {
    key: 'general.appName',
    value: 'WorkIndia',
    type: 'string',
    group: 'general',
    description: 'Public platform display name',
    isPublic: true,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'general.supportEmail',
    value: 'support@workindia.local',
    type: 'string',
    group: 'general',
    description: 'Public support contact email',
    isPublic: true,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'general.supportPhone',
    value: '',
    type: 'string',
    group: 'general',
    description: 'Public support phone (optional)',
    isPublic: true,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'jobs.public.defaultPageSize',
    value: 20,
    type: 'number',
    group: 'jobs',
    description: 'Default page size for public job listings',
    isPublic: true,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'jobs.public.maxPageSize',
    value: 100,
    type: 'number',
    group: 'jobs',
    description: 'Maximum allowed page size for public job listings (hard ceiling remains in validators)',
    isPublic: false,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'jobs.defaultExpiryDays',
    value: 30,
    type: 'number',
    group: 'jobs',
    description: 'Default job expiry window in days when no deadline is set (informational/defaulting aid)',
    isPublic: false,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'career.public.defaultPageSize',
    value: 20,
    type: 'number',
    group: 'seo',
    description: 'Default page size for public career advice listings',
    isPublic: true,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'seo.indexingEnabled',
    value: true,
    type: 'boolean',
    group: 'seo',
    description:
      'Whether public marketing pages should be offered for search engine indexing (sheet 456). Staging should set false; Next.js also gates via NEXT_PUBLIC_SEO_INDEXING_ENABLED / SITE_URL.',
    isPublic: true,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'seo.googleSiteVerification',
    value: '',
    type: 'string',
    group: 'seo',
    description: 'Optional Google Search Console verification token (informational; frontend uses NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION)',
    isPublic: false,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'notifications.retentionDays',
    value: 90,
    type: 'number',
    group: 'notifications',
    description: 'Suggested retention window for in-app notifications (days)',
    isPublic: false,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'candidate.defaultProfileVisibility',
    value: 'public',
    type: 'string',
    group: 'candidate',
    description: 'Default profile visibility for new candidates (documentation/default reference)',
    isPublic: false,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'subscriptions.plansPublic',
    value: true,
    type: 'boolean',
    group: 'subscriptions',
    description: 'Whether subscription plans are listed on the public plans endpoint',
    isPublic: true,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'subscriptions.autoRenewGraceHours',
    value: 24,
    type: 'number',
    group: 'subscriptions',
    description: 'Hours before endDate when auto-renew worker extends paid subscriptions (sheet 412)',
    isPublic: false,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'subscriptions.creditCosts',
    value: { contactUnlock: 1, boostNotify: 5, featuredJob: 10 },
    type: 'json',
    group: 'subscriptions',
    description:
      'Wallet credit costs for unlock / boost / featured when plan entitlements are exhausted (sheet 406–408)',
    isPublic: false,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'subscriptions.creditPacks',
    value: [
      {
        id: 'credits_50',
        name: '50 Credits',
        credits: 50,
        price: 999,
        description: 'Unlock candidate contacts and boost visibility.',
      },
      {
        id: 'credits_150',
        name: '150 Credits',
        credits: 150,
        price: 2499,
        description: 'Best for growing hiring teams.',
      },
      {
        id: 'credits_500',
        name: '500 Credits',
        credits: 500,
        price: 6999,
        description: 'High-volume recruiting pack.',
      },
    ],
    type: 'json',
    group: 'subscriptions',
    description: 'Purchasable credit pack catalog (sheet 409)',
    isPublic: false,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'uploads.displayMaxResumeMb',
    value: 5,
    type: 'number',
    group: 'uploads',
    description: 'Publicly displayed max resume size in MB (security limits remain code constants)',
    isPublic: true,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'uploads.displayMaxAvatarMb',
    value: 2,
    type: 'number',
    group: 'uploads',
    description: 'Publicly displayed max avatar size in MB',
    isPublic: true,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'analytics.enabled',
    value: true,
    type: 'boolean',
    group: 'analytics',
    description: 'Whether analytics event tracking is enabled',
    isPublic: false,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'platform.maintenance.enabled',
    value: false,
    type: 'boolean',
    group: 'maintenance',
    description: 'When true, non-admin public/user APIs return maintenance responses',
    isPublic: true,
    isActive: true,
    isEditable: true,
  },
  {
    key: 'platform.maintenance.message',
    value: 'WorkIndia is temporarily under maintenance. Please try again shortly.',
    type: 'string',
    group: 'maintenance',
    description: 'Public message shown during maintenance mode',
    isPublic: true,
    isActive: true,
    isEditable: true,
  },
];

export const SETTING_KEYS = DEFAULT_PLATFORM_SETTINGS.map((s) => s.key);
