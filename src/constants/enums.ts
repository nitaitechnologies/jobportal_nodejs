/** Controlled domain enums for Mongoose schemas. */

export const USER_ROLES = ['candidate', 'employer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Company-scoped recruiter roles (sheet 161). */
export const EMPLOYER_TEAM_ROLES = ['owner', 'hr', 'recruiter'] as const;
export type EmployerTeamRole = (typeof EMPLOYER_TEAM_ROLES)[number];

export const EMPLOYER_TEAM_INVITE_STATUSES = [
  'pending',
  'accepted',
  'revoked',
  'expired',
] as const;
export type EmployerTeamInviteStatus = (typeof EMPLOYER_TEAM_INVITE_STATUSES)[number];

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

/** Candidate job-type prefs (includes FE `work-from-home`). */
export const CANDIDATE_JOB_TYPES = [...EMPLOYMENT_TYPES, 'work-from-home'] as const;
export type CandidateJobType = (typeof CANDIDATE_JOB_TYPES)[number];

export const WORKING_DAY_PREFERENCES = ['weekdays', 'weekends', 'flexible'] as const;
export type WorkingDayPreference = (typeof WORKING_DAY_PREFERENCES)[number];

export const SHIFT_PREFERENCES = ['day', 'night', 'rotating', 'flexible'] as const;
export type ShiftPreference = (typeof SHIFT_PREFERENCES)[number];

/** Job posting shift options (public job search filter). */
export const JOB_SHIFTS = [
  'morning',
  'day',
  'evening',
  'night',
  'weekend',
  'flexible',
  'rotating',
] as const;
export type JobShift = (typeof JOB_SHIFTS)[number];

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

/** Sold role ads: pay per click, or affiliate course/partner links. */
export const ROLE_AD_TYPES = ['click', 'affiliate'] as const;
export type RoleAdType = (typeof ROLE_AD_TYPES)[number];

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
  'APPLICATION_CONFIRMATION',
  'APPLICATION_STATUS_CHANGED',
  'APPLICATION_SHORTLISTED',
  'RECRUITER_VIEWED_PROFILE',
  'RECRUITER_INVITATION',
  'RECONTACT_REMINDER',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_RESCHEDULED',
  'INTERVIEW_CANCELLED',
  'INTERVIEW_CONFIRMED',
  'INTERVIEW_DECLINED',
  'INTERVIEW_REMINDER_24H',
  'INTERVIEW_REMINDER_1H',
  'JOB_STATUS_CHANGED',
  'JOB_EXPIRY_REMINDER',
  'JOB_PERFORMANCE',
  'MATCHING_CANDIDATE',
  'CANDIDATE_RECOMMENDATION',
  'SUBSCRIPTION_EXPIRY',
  'REPORT_STATUS_CHANGED',
  'JOB_ALERT_INSTANT',
  'JOB_ALERT_DAILY',
  'JOB_ALERT_WEEKLY',
  'JOB_MATCH',
  'JOB_NEARBY',
  'JOB_SALARY_MATCH',
  'HOT_JOB',
  'JOB_DEADLINE',
  'GOVERNMENT_JOB',
  'CHAT_MESSAGE',
  'CHAT_FILE',
  'CHAT_RESUME_SHARE',
  'PAYMENT_SUCCEEDED',
  'PAYMENT_FAILED',
  'PAYMENT_REFUND',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Saved-search / job-alert digest cadence. */
export const ALERT_FREQUENCIES = ['instant', 'daily', 'weekly', 'off'] as const;
export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number];

/** Employer → candidate job invitation lifecycle. */
export const INVITATION_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'cancelled',
  'expired',
] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const ARTICLE_STATUSES = ['draft', 'published', 'archived'] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const REPORT_TARGET_TYPES = [
  'job',
  'company',
  'employer',
  'candidate',
  'user',
  'platform',
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_STATUSES = [
  'pending',
  'reviewing',
  'resolved',
  'dismissed',
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Controlled report reasons (B19) + support/tech (sheet 374, 377). */
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
  'technical_issue',
  'account_help',
  'billing_help',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Support ticket categories for raise-ticket / contact form (sheet 374). */
export const SUPPORT_TICKET_CATEGORIES = [
  'candidate-support',
  'employer-support',
  'job-listing',
  'technical-issue',
  'billing',
  'partnership',
  'other',
] as const;
export type SupportTicketCategory = (typeof SUPPORT_TICKET_CATEGORIES)[number];

export const SUPPORT_TICKET_STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'closed',
] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

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

/** Subscription coupon discount types (sheet 348). */
export const COUPON_TYPES = ['percent', 'fixed'] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

export const COUPON_STATUSES = ['active', 'inactive'] as const;
export type CouponStatus = (typeof COUPON_STATUSES)[number];

/** Simulated payment kinds (sheet 359–365) — no live gateway yet. */
export const PAYMENT_KINDS = ['subscription', 'credits'] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_STATUSES = [
  'pending',
  'succeeded',
  'failed',
  'refunded',
  'partially_refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const INVOICE_STATUSES = ['draft', 'issued', 'void', 'refunded'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const WALLET_TXN_TYPES = [
  'purchase',
  'spend_unlock',
  'spend_boost',
  'spend_featured',
  'refund',
  'adjustment',
] as const;
export type WalletTxnType = (typeof WALLET_TXN_TYPES)[number];

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
  // Job alerts
  'job_alert_sent',
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
