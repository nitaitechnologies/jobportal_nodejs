/** Controlled domain enums for Mongoose schemas. */

export const USER_ROLES = ['candidate', 'employer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'inactive', 'suspended', 'deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ACCOUNT_STATUSES = ['active', 'inactive', 'suspended'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const EMPLOYMENT_STATUSES = [
  'employed',
  'unemployed',
  'freelancer',
  'student',
  'looking',
] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const;
export type Gender = (typeof GENDERS)[number];

export const PROFILE_VISIBILITY = ['public', 'private', 'employers_only'] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITY)[number];

export const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export const VERIFICATION_STATUSES = [
  'unverified',
  'pending',
  'verified',
  'rejected',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const WORK_MODES = ['onsite', 'hybrid', 'remote'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const EMPLOYMENT_TYPES = [
  'full-time',
  'part-time',
  'contract',
  'internship',
  'temporary',
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const SALARY_PERIODS = ['monthly', 'yearly', 'hourly', 'daily'] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];

export const JOB_STATUSES = [
  'draft',
  'pending',
  'published',
  'paused',
  'closed',
  'rejected',
  'expired',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const APPLICATION_METHODS = ['platform', 'external', 'email'] as const;
export type ApplicationMethod = (typeof APPLICATION_METHODS)[number];

export const LOCATION_TYPES = ['country', 'state', 'city', 'area'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const ENTITY_STATUSES = ['active', 'inactive'] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

export const APPLICATION_STATUSES = [
  'applied',
  'viewed',
  'shortlisted',
  'interview',
  'rejected',
  'hired',
  'withdrawn',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const INTERVIEW_TYPES = ['online', 'phone', 'onsite'] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

/** Interview lifecycle (B3 + B16 confirmation/decline). */
export const INTERVIEW_STATUSES = [
  'scheduled',
  'confirmed',
  'rescheduled',
  'completed',
  'cancelled',
  'declined',
  'no-show',
] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

/** In-app notification types (B17). */
export const NOTIFICATION_TYPES = [
  'APPLICATION_SUBMITTED',
  'APPLICATION_STATUS_CHANGED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_RESCHEDULED',
  'INTERVIEW_CANCELLED',
  'INTERVIEW_CONFIRMED',
  'INTERVIEW_DECLINED',
  'JOB_STATUS_CHANGED',
  'REPORT_STATUS_CHANGED',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const ARTICLE_STATUSES = ['draft', 'published', 'archived'] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const REPORT_TARGET_TYPES = [
  'job',
  'company',
  'employer',
  'candidate',
  'user',
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_STATUSES = [
  'pending',
  'reviewing',
  'resolved',
  'dismissed',
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Controlled report reasons (B19). */
export const REPORT_REASONS = [
  'fraud',
  'scam',
  'fake_job',
  'misleading_information',
  'harassment',
  'spam',
  'discrimination',
  'inappropriate_content',
  'duplicate_listing',
  'privacy_concern',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const SUBSCRIPTION_STATUSES = [
  'active',
  'cancelled',
  'expired',
  'past_due',
  'trial',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BILLING_CYCLES = ['monthly', 'quarterly', 'yearly'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const PLAN_STATUSES = ['active', 'inactive'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const CURRENCIES = ['INR'] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export const ADMIN_ROLES = [
  'super_admin',
  'admin',
  'moderator',
  'support',
] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const SETTING_VALUE_TYPES = [
  'string',
  'number',
  'boolean',
  'json',
] as const;
export type SettingValueType = (typeof SETTING_VALUE_TYPES)[number];

export const ANALYTICS_EVENT_TYPES = [
  // Auth
  'candidate_login',
  'employer_login',
  'admin_login',
  // Jobs
  'job_view',
  'job_search',
  'job_created',
  'job_published',
  'job_paused',
  'job_closed',
  'job_featured',
  'company_view',
  // Applications
  'application_submitted',
  'application_withdrawn',
  'application_status_changed',
  // Saved jobs
  'job_saved',
  'job_unsaved',
  // Interviews
  'interview_scheduled',
  'interview_rescheduled',
  'interview_cancelled',
  'interview_confirmed',
  'interview_declined',
  // Career
  'career_article_view',
  'profile_view',
  // Reports
  'report_created',
  'report_resolved',
  // Subscriptions
  'subscription_activated',
  'subscription_changed',
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export const ANALYTICS_ACTOR_ROLES = [
  'candidate',
  'employer',
  'admin',
  'anonymous',
  'system',
] as const;
export type AnalyticsActorRole = (typeof ANALYTICS_ACTOR_ROLES)[number];

export const ANALYTICS_ENTITY_TYPES = [
  'job',
  'company',
  'application',
  'interview',
  'candidate',
  'employer',
  'user',
  'category',
  'location',
  'article',
  'report',
  'subscription',
  'plan',
] as const;
export type AnalyticsEntityType = (typeof ANALYTICS_ENTITY_TYPES)[number];

export const ANALYTICS_DATE_PRESETS = [
  'today',
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'custom',
] as const;
export type AnalyticsDatePreset = (typeof ANALYTICS_DATE_PRESETS)[number];

export const ANALYTICS_GRANULARITIES = ['day', 'week', 'month'] as const;
export type AnalyticsGranularity = (typeof ANALYTICS_GRANULARITIES)[number];
