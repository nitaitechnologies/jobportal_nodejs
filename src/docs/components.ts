import type { OpenAPIV3 } from 'openapi-types';
import {
  ACCOUNT_STATUSES,
  ADMIN_ROLES,
  ANALYTICS_DATE_PRESETS,
  ANALYTICS_EVENT_TYPES,
  ANALYTICS_GRANULARITIES,
  APPLICATION_STATUSES,
  ARTICLE_STATUSES,
  BILLING_CYCLES,
  COMPANY_SIZES,
  EMPLOYMENT_TYPES,
  INTERVIEW_STATUSES,
  INTERVIEW_TYPES,
  INVITATION_STATUSES,
  JOB_STATUSES,
  LOCATION_TYPES,
  NOTIFICATION_TYPES,
  ALERT_FREQUENCIES,
  PLAN_STATUSES,
  PROFILE_VISIBILITY,
  REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_TARGET_TYPES,
  SETTING_VALUE_TYPES,
  SUBSCRIPTION_STATUSES,
  USER_ROLES,
  USER_STATUSES,
  VERIFICATION_STATUSES,
  WORK_MODES,
} from '../constants/enums';
import { SETTING_GROUPS } from '../constants/platformSettings';

function strEnum(values: readonly string[], description?: string): OpenAPIV3.SchemaObject {
  return {
    type: 'string',
    enum: [...values],
    ...(description ? { description } : {}),
  };
}

const ErrorItem: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: true,
  properties: {
    path: { type: 'string' },
    message: { type: 'string' },
  },
};

const PaginationMeta: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['page', 'limit', 'total', 'totalPages'],
  properties: {
    page: { type: 'integer', minimum: 1, example: 1 },
    limit: { type: 'integer', minimum: 1, example: 20 },
    total: { type: 'integer', minimum: 0, example: 100 },
    totalPages: { type: 'integer', minimum: 0, example: 5 },
  },
};

const ApiError: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['success', 'message', 'errors'],
  properties: {
    success: { type: 'boolean', enum: [false] },
    message: { type: 'string', example: 'Validation failed' },
    errors: { type: 'array', items: ErrorItem },
  },
};

/** Wrap a data schema in the standard success envelope. */
export function successSchema(
  data: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
  messageExample = 'Operation successful',
): OpenAPIV3.SchemaObject {
  return {
    type: 'object',
    required: ['success', 'message', 'data'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      message: { type: 'string', example: messageExample },
      data,
    },
  };
}

export const components: OpenAPIV3.ComponentsObject = {
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'JWT access token from candidate, employer, or admin login. Send as `Authorization: Bearer <token>`.',
    },
  },
  parameters: {
    Page: {
      name: 'page',
      in: 'query',
      schema: { type: 'integer', minimum: 1, default: 1 },
      description: 'Page number (1-based)',
    },
    Limit: {
      name: 'limit',
      in: 'query',
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      description: 'Page size (max typically 50–100 depending on endpoint)',
    },
    Search: {
      name: 'search',
      in: 'query',
      schema: { type: 'string', maxLength: 120 },
      description: 'Free-text search',
    },
    SortOrder: {
      name: 'sortOrder',
      in: 'query',
      schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
    },
    ObjectId: {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
      description: 'MongoDB ObjectId (24 hex chars)',
    },
    Slug: {
      name: 'slug',
      in: 'path',
      required: true,
      schema: { type: 'string', minLength: 1, maxLength: 200 },
    },
  },
  schemas: {
    ApiError,
    PaginationMeta,
    ErrorItem,
    UserRole: strEnum(USER_ROLES),
    UserStatus: strEnum(USER_STATUSES),
    AccountStatus: strEnum(ACCOUNT_STATUSES),
    AdminRole: strEnum(ADMIN_ROLES),
    JobStatus: strEnum(JOB_STATUSES),
    WorkMode: strEnum(WORK_MODES),
    EmploymentType: strEnum(EMPLOYMENT_TYPES),
    ApplicationStatus: strEnum(APPLICATION_STATUSES),
    InvitationStatus: strEnum(INVITATION_STATUSES),
    NotificationType: strEnum(NOTIFICATION_TYPES),
    AlertFrequency: strEnum(ALERT_FREQUENCIES),
    InterviewType: strEnum(INTERVIEW_TYPES),
    InterviewStatus: strEnum(INTERVIEW_STATUSES),
    ProfileVisibility: strEnum(PROFILE_VISIBILITY),
    CompanySize: strEnum(COMPANY_SIZES),
    VerificationStatus: strEnum(VERIFICATION_STATUSES),
    LocationType: strEnum(LOCATION_TYPES),
    ArticleStatus: strEnum(ARTICLE_STATUSES),
    ReportTargetType: strEnum(REPORT_TARGET_TYPES),
    ReportStatus: strEnum(REPORT_STATUSES),
    ReportReason: strEnum(REPORT_REASONS),
    SubscriptionStatus: strEnum(SUBSCRIPTION_STATUSES),
    BillingCycle: strEnum(BILLING_CYCLES),
    PlanStatus: strEnum(PLAN_STATUSES),
    SettingValueType: strEnum(SETTING_VALUE_TYPES),
    SettingGroup: strEnum(SETTING_GROUPS),
    AnalyticsEventType: strEnum(ANALYTICS_EVENT_TYPES),
    AnalyticsDatePreset: strEnum(ANALYTICS_DATE_PRESETS),
    AnalyticsGranularity: strEnum(ANALYTICS_GRANULARITIES),

    AuthTokens: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', description: 'JWT access token' },
        user: { type: 'object', additionalProperties: true },
      },
    },

    CandidateRegisterRequest: {
      type: 'object',
      required: ['name', 'email', 'phone', 'password'],
      properties: {
        name: { type: 'string', minLength: 2, maxLength: 120, example: 'Priya Sharma' },
        email: { type: 'string', format: 'email', example: 'priya@example.com' },
        phone: { type: 'string', example: '9876543210' },
        password: {
          type: 'string',
          minLength: 8,
          maxLength: 128,
          example: 'SecurePass123',
          description: 'Min 8 chars with at least one letter and one number',
        },
      },
    },
    LoginRequest: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
        password: { type: 'string', minLength: 8, maxLength: 128, example: 'SecurePass123' },
      },
    },
    CandidateOtpSendRequest: {
      type: 'object',
      required: ['phone'],
      properties: {
        phone: {
          type: 'string',
          example: '9876543210',
          description: '10-digit Indian mobile number',
        },
      },
    },
    CandidateOtpVerifyRequest: {
      type: 'object',
      required: ['phone', 'otp'],
      properties: {
        phone: { type: 'string', example: '9876543210' },
        otp: {
          type: 'string',
          example: '123456',
          description: 'Dummy OTP is 123456 until SMS provider is wired (CANDIDATE_OTP_DUMMY)',
        },
        name: {
          type: 'string',
          minLength: 2,
          maxLength: 120,
          example: 'Priya Sharma',
          description: 'Required for first-time mobile signup; optional for returning users',
        },
      },
    },
    CandidatePasswordForgotRequest: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email', example: 'priya@example.com' },
        phone: { type: 'string', example: '9876543210' },
      },
      description: 'Provide exactly one of email or phone',
    },
    CandidatePasswordResetRequest: {
      type: 'object',
      required: ['otp', 'password'],
      properties: {
        email: { type: 'string', format: 'email', example: 'priya@example.com' },
        phone: { type: 'string', example: '9876543210' },
        otp: {
          type: 'string',
          example: '123456',
          description: 'Dummy reset code is 123456 (CANDIDATE_OTP_DUMMY) until email/SMS is wired',
        },
        password: {
          type: 'string',
          minLength: 8,
          maxLength: 128,
          example: 'NewSecurePass123',
          description: 'Min 8 chars with at least one letter and one number',
        },
      },
      description: 'Provide exactly one of email or phone, plus otp and new password',
    },
    CandidateAccountDeleteRequest: {
      type: 'object',
      required: ['confirm'],
      properties: {
        confirm: {
          type: 'boolean',
          example: true,
          description: 'Must be true to confirm permanent account deletion',
        },
      },
    },
    EmployerRegisterRequest: {
      type: 'object',
      required: ['name', 'email', 'phone', 'password', 'companyName'],
      properties: {
        name: { type: 'string', minLength: 2, maxLength: 120, example: 'Rahul Mehta' },
        email: { type: 'string', format: 'email', example: 'hr@acme.example' },
        phone: { type: 'string', example: '9876543211' },
        password: { type: 'string', minLength: 8, example: 'SecurePass123' },
        companyName: { type: 'string', minLength: 2, maxLength: 200, example: 'Acme Pvt Ltd' },
      },
    },

    PaginationData: {
      type: 'object',
      properties: {
        pagination: { $ref: '#/components/schemas/PaginationMeta' },
      },
      additionalProperties: true,
    },

    FileUpload: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Binary file upload field name: file' },
      },
    },

    ObjectId: {
      type: 'string',
      pattern: '^[a-fA-F0-9]{24}$',
      example: '507f1f77bcf86cd799439011',
    },

    JobCreateRequest: {
      type: 'object',
      required: ['title', 'description'],
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 3, maxLength: 200, example: 'Senior Node.js Developer' },
        description: { type: 'string', example: 'Build and maintain APIs…' },
        categoryId: { $ref: '#/components/schemas/ObjectId' },
        locationId: { $ref: '#/components/schemas/ObjectId' },
        workMode: { $ref: '#/components/schemas/WorkMode' },
        employmentType: { $ref: '#/components/schemas/EmploymentType' },
        experienceMin: { type: 'number' },
        experienceMax: { type: 'number' },
        salaryMin: { type: 'number' },
        salaryMax: { type: 'number' },
        skills: { type: 'array', items: { type: 'string' }, maxItems: 50 },
        vacancies: { type: 'integer', minimum: 1 },
      },
    },

    ApplicationApplyRequest: {
      type: 'object',
      additionalProperties: false,
      properties: {
        coverLetter: { type: 'string', maxLength: 10000 },
        resume: {
          type: 'string',
          maxLength: 500,
          description: 'Optional owned media:<id> or http(s) URL; defaults to profile resume',
        },
        videoResume: {
          type: 'string',
          maxLength: 500,
          description: 'Optional owned media:<id> video resume when feature enabled',
        },
        answers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              answer: { type: 'string' },
            },
          },
        },
      },
    },

    InvitationCreateRequest: {
      type: 'object',
      required: ['candidateId', 'jobId'],
      additionalProperties: false,
      properties: {
        candidateId: { $ref: '#/components/schemas/ObjectId' },
        jobId: { $ref: '#/components/schemas/ObjectId' },
        message: { type: 'string', maxLength: 2000 },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },

    SavedSearchCreateRequest: {
      type: 'object',
      required: ['name'],
      additionalProperties: false,
      properties: {
        name: { type: 'string', maxLength: 120 },
        frequency: { $ref: '#/components/schemas/AlertFrequency' },
        isActive: { type: 'boolean' },
        filters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            q: { type: 'string' },
            categoryId: { $ref: '#/components/schemas/ObjectId' },
            locationId: { $ref: '#/components/schemas/ObjectId' },
            workMode: { $ref: '#/components/schemas/WorkMode' },
            employmentType: { $ref: '#/components/schemas/EmploymentType' },
            experienceMin: { type: 'number' },
            experienceMax: { type: 'number' },
            salaryMin: { type: 'number' },
            salaryMax: { type: 'number' },
            featured: { type: 'boolean' },
            urgent: { type: 'boolean' },
            government: { type: 'boolean' },
            lat: { type: 'number' },
            lng: { type: 'number' },
            radiusKm: { type: 'number' },
            skills: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },

    SavedSearchUpdateRequest: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', maxLength: 120 },
        frequency: { $ref: '#/components/schemas/AlertFrequency' },
        isActive: { type: 'boolean' },
        filters: { type: 'object' },
      },
    },

    AlertSettingsUpdateRequest: {
      type: 'object',
      additionalProperties: false,
      properties: {
        matchingJobs: { type: 'boolean' },
        matchScoreMin: { type: 'integer', minimum: 0, maximum: 100 },
        nearbyJobs: { type: 'boolean' },
        nearbyRadiusKm: { type: 'number' },
        salaryAlerts: { type: 'boolean' },
        hotJobs: { type: 'boolean' },
        deadlineAlerts: { type: 'boolean' },
        deadlineDays: { type: 'integer', minimum: 1, maximum: 30 },
        governmentJobs: { type: 'boolean' },
        digestFrequency: { $ref: '#/components/schemas/AlertFrequency' },
      },
    },

    InterviewCreateRequest: {
      type: 'object',
      required: ['applicationId', 'type', 'scheduledAt'],
      properties: {
        applicationId: { $ref: '#/components/schemas/ObjectId' },
        type: { $ref: '#/components/schemas/InterviewType' },
        scheduledAt: { type: 'string', format: 'date-time' },
        durationMinutes: { type: 'integer', minimum: 5, maximum: 480 },
        location: { type: 'string' },
        meetingLink: {
          type: 'string',
          format: 'uri',
          description: 'Required for online interviews; https only',
        },
        interviewer: { type: 'string', maxLength: 200 },
        notes: { type: 'string' },
      },
    },

    InterviewRescheduleRequest: {
      type: 'object',
      required: ['scheduledAt'],
      properties: {
        scheduledAt: { type: 'string', format: 'date-time' },
        duration: { type: 'integer', minimum: 5, maximum: 480 },
        location: { type: 'string' },
        meetingLink: {
          type: 'string',
          format: 'uri',
          description: 'https only',
        },
        notes: { type: 'string', maxLength: 5000 },
      },
    },

    ReportCreateRequest: {
      type: 'object',
      required: ['targetType', 'targetId', 'reason'],
      properties: {
        targetType: { $ref: '#/components/schemas/ReportTargetType' },
        targetId: { $ref: '#/components/schemas/ObjectId' },
        reason: { $ref: '#/components/schemas/ReportReason' },
        description: { type: 'string', maxLength: 2000 },
      },
    },

    SettingCreateRequest: {
      type: 'object',
      required: ['key', 'value', 'type', 'group'],
      properties: {
        key: { type: 'string', example: 'jobs.customBanner' },
        value: {},
        type: { $ref: '#/components/schemas/SettingValueType' },
        group: { $ref: '#/components/schemas/SettingGroup' },
        description: { type: 'string', maxLength: 500 },
        isPublic: { type: 'boolean', default: false },
        isActive: { type: 'boolean', default: true },
        isEditable: { type: 'boolean', default: true },
      },
    },

    HealthData: {
      type: 'object',
      properties: {
        service: { type: 'string', example: 'workindia-api' },
        database: {
          type: 'string',
          enum: ['connected', 'disconnected', 'connecting', 'disconnecting'],
        },
      },
    },
  },
  responses: {
    BadRequest: {
      description: 'Validation error',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
      },
    },
    Unauthorized: {
      description: 'Missing or invalid JWT',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
      },
    },
    Forbidden: {
      description: 'Authenticated but not allowed',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
      },
    },
    NotFound: {
      description: 'Resource not found',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
      },
    },
    Conflict: {
      description: 'Conflict (duplicate key, invalid state transition)',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
      },
    },
    TooManyRequests: {
      description: 'Auth rate limit exceeded',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
      },
    },
    InternalError: {
      description: 'Unexpected server error',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
      },
    },
  },
};
