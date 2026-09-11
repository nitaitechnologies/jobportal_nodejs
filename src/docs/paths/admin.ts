import type { OpenAPIV3 } from 'openapi-types';
import { idParam, jsonBody, multipartFile, op, pageParams } from '../helpers';

const obj = { type: 'object' as const, additionalProperties: true };

function adminGet(
  operationId: string,
  tag: string,
  summary: string,
  permission: string,
  parameters?: (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[],
): OpenAPIV3.OperationObject {
  return op({
    operationId,
    tags: [tag],
    summary,
    description: `Requires admin JWT and permission \`${permission}\`.`,
    parameters,
    data: obj,
    errors: ['400', '401', '403', '404'],
  });
}

export const adminPaths: OpenAPIV3.PathsObject = {
  // Settings
  '/api/v1/admin/settings': {
    get: adminGet('listAdminSettings', 'Admin Settings', 'List platform settings', 'settings.read', [
      ...pageParams(),
      { $ref: '#/components/parameters/Search' },
      { name: 'group', in: 'query', schema: { $ref: '#/components/schemas/SettingGroup' } },
      { name: 'type', in: 'query', schema: { $ref: '#/components/schemas/SettingValueType' } },
      { name: 'isPublic', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
      { name: 'isActive', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
      { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['key', 'group', 'updatedAt', 'createdAt'] } },
      { $ref: '#/components/parameters/SortOrder' },
    ]),
    post: op({
      operationId: 'createAdminSetting',
      tags: ['Admin Settings'],
      summary: 'Create setting',
      description: 'Requires `settings.create` + admin/super_admin. Protected namespaces rejected.',
      requestBody: jsonBody({ $ref: '#/components/schemas/SettingCreateRequest' }),
      data: obj,
      errors: ['400', '401', '403', '409'],
    }),
  },
  '/api/v1/admin/settings/{key}': {
    get: op({
      operationId: 'getAdminSetting',
      tags: ['Admin Settings'],
      summary: 'Get setting by key',
      description: 'Requires `settings.read`.',
      parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
    patch: op({
      operationId: 'updateAdminSetting',
      tags: ['Admin Settings'],
      summary: 'Update setting value/metadata',
      description: 'Requires `settings.update`. Type and key are immutable.',
      parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: jsonBody({
        type: 'object',
        properties: {
          value: {},
          description: { type: 'string' },
          isPublic: { type: 'boolean' },
          group: { $ref: '#/components/schemas/SettingGroup' },
        },
      }),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/admin/settings/{key}/status': {
    patch: op({
      operationId: 'updateAdminSettingStatus',
      tags: ['Admin Settings'],
      summary: 'Activate / deactivate setting',
      parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: jsonBody({
        type: 'object',
        required: ['isActive'],
        properties: { isActive: { type: 'boolean' } },
      }),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },

  // Categories
  '/api/v1/admin/categories': {
    get: adminGet('listAdminCategories', 'Admin Categories', 'List categories', 'categories.read', pageParams()),
    post: op({
      operationId: 'createAdminCategory',
      tags: ['Admin Categories'],
      summary: 'Create category',
      description: 'Requires `categories.create`.',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '409'],
    }),
  },
  '/api/v1/admin/categories/{id}': {
    get: adminGet('getAdminCategory', 'Admin Categories', 'Get category', 'categories.read', [idParam()]),
    patch: op({
      operationId: 'updateAdminCategory',
      tags: ['Admin Categories'],
      summary: 'Update category',
      description: 'Requires `categories.update`.',
      parameters: [idParam()],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
    delete: op({
      operationId: 'deleteAdminCategory',
      tags: ['Admin Categories'],
      summary: 'Delete category',
      description: 'Requires `categories.delete`.',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },

  // Locations
  '/api/v1/admin/locations': {
    get: adminGet('listAdminLocations', 'Admin Locations', 'List locations', 'locations.read', pageParams()),
    post: op({
      operationId: 'createAdminLocation',
      tags: ['Admin Locations'],
      summary: 'Create location',
      description: 'Requires `locations.create`.',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '409'],
    }),
  },
  '/api/v1/admin/locations/{id}': {
    get: adminGet('getAdminLocation', 'Admin Locations', 'Get location', 'locations.read', [idParam()]),
    patch: op({
      operationId: 'updateAdminLocation',
      tags: ['Admin Locations'],
      summary: 'Update location',
      description: 'Requires `locations.update`.',
      parameters: [idParam()],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
    delete: op({
      operationId: 'deleteAdminLocation',
      tags: ['Admin Locations'],
      summary: 'Delete location',
      description: 'Requires `locations.delete`.',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },

  // Career advice
  '/api/v1/admin/career-advice': {
    get: adminGet('listAdminCareerAdvice', 'Admin Career Advice', 'List articles', 'articles.read', pageParams()),
    post: op({
      operationId: 'createAdminCareerAdvice',
      tags: ['Admin Career Advice'],
      summary: 'Create article',
      description: 'Requires `articles.create`. Content is sanitized.',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/admin/career-advice/{id}': {
    get: adminGet('getAdminCareerAdvice', 'Admin Career Advice', 'Get article', 'articles.read', [idParam()]),
    patch: op({
      operationId: 'updateAdminCareerAdvice',
      tags: ['Admin Career Advice'],
      summary: 'Update article',
      description: 'Requires `articles.update`.',
      parameters: [idParam()],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
    delete: op({
      operationId: 'deleteAdminCareerAdvice',
      tags: ['Admin Career Advice'],
      summary: 'Delete article',
      description: 'Requires `articles.delete`.',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/admin/career-advice/{id}/image': {
    post: op({
      operationId: 'uploadCareerAdviceImage',
      tags: ['Admin Career Advice', 'Files'],
      summary: 'Upload article image',
      description: 'Requires `articles.update`.',
      parameters: [idParam()],
      requestBody: multipartFile(),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
    delete: op({
      operationId: 'deleteCareerAdviceImage',
      tags: ['Admin Career Advice', 'Files'],
      summary: 'Delete article image',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/admin/career-advice/{id}/publish': {
    patch: op({
      operationId: 'publishCareerAdvice',
      tags: ['Admin Career Advice'],
      summary: 'Publish article',
      description: 'Requires `articles.publish`.',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/admin/career-advice/{id}/unpublish': {
    patch: op({
      operationId: 'unpublishCareerAdvice',
      tags: ['Admin Career Advice'],
      summary: 'Unpublish article',
      description: 'Requires `articles.publish`.',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },

  // Reports
  '/api/v1/admin/reports': {
    get: adminGet('listAdminReports', 'Admin Reports', 'List reports', 'reports.read', [
      ...pageParams(),
      { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/ReportStatus' } },
    ]),
  },
  '/api/v1/admin/reports/{id}': {
    get: adminGet('getAdminReport', 'Admin Reports', 'Get report', 'reports.read', [idParam()]),
    patch: op({
      operationId: 'resolveAdminReport',
      tags: ['Admin Reports'],
      summary: 'Update / resolve report',
      description: 'Requires `reports.resolve`.',
      parameters: [idParam()],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },

  // Plans / subscriptions
  '/api/v1/admin/subscription-plans': {
    get: adminGet('listAdminPlans', 'Admin Subscriptions', 'List plans', 'plans.read', pageParams()),
    post: op({
      operationId: 'createAdminPlan',
      tags: ['Admin Subscriptions'],
      summary: 'Create subscription plan',
      description: 'Requires `plans.create`. No payment gateway.',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '409'],
    }),
  },
  '/api/v1/admin/subscription-plans/{id}': {
    get: adminGet('getAdminPlan', 'Admin Subscriptions', 'Get plan', 'plans.read', [idParam()]),
    patch: op({
      operationId: 'updateAdminPlan',
      tags: ['Admin Subscriptions'],
      summary: 'Update plan',
      description: 'Requires `plans.update`.',
      parameters: [idParam()],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/admin/subscription-plans/{id}/deactivate': {
    patch: op({
      operationId: 'deactivateAdminPlan',
      tags: ['Admin Subscriptions'],
      summary: 'Deactivate plan',
      description: 'Requires `plans.update`.',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/admin/subscriptions': {
    post: op({
      operationId: 'assignAdminSubscription',
      tags: ['Admin Subscriptions'],
      summary: 'Assign / activate employer subscription',
      description: 'Requires `subscriptions.manage`. Manual assignment only — no payments.',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },

  // Analytics
  '/api/v1/admin/analytics/overview': {
    get: adminGet('getAdminAnalyticsOverview', 'Admin Analytics', 'Analytics overview', 'analytics.read', [
      { name: 'preset', in: 'query', schema: { $ref: '#/components/schemas/AnalyticsDatePreset' } },
      { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
      { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
      { name: 'granularity', in: 'query', schema: { $ref: '#/components/schemas/AnalyticsGranularity' } },
    ]),
  },
  '/api/v1/admin/analytics/events': {
    get: adminGet('listAdminAnalyticsEvents', 'Admin Analytics', 'List analytics events', 'analytics.read', [
      ...pageParams(),
      { name: 'eventType', in: 'query', schema: { $ref: '#/components/schemas/AnalyticsEventType' } },
    ]),
  },
  '/api/v1/admin/analytics/jobs': {
    get: adminGet('getAdminJobAnalytics', 'Admin Analytics', 'Job analytics', 'analytics.read'),
  },
  '/api/v1/admin/analytics/employers': {
    get: adminGet('getAdminEmployerAnalytics', 'Admin Analytics', 'Employer analytics', 'analytics.read'),
  },
  '/api/v1/admin/analytics/candidates': {
    get: adminGet('getAdminCandidateAnalytics', 'Admin Analytics', 'Candidate analytics', 'analytics.read'),
  },
  '/api/v1/admin/analytics/categories': {
    get: adminGet('getAdminCategoryAnalytics', 'Admin Analytics', 'Category analytics', 'analytics.read'),
  },
  '/api/v1/admin/analytics/locations': {
    get: adminGet('getAdminLocationAnalytics', 'Admin Analytics', 'Location analytics', 'analytics.read'),
  },

  // Admin users
  '/api/v1/admin/admin-users': {
    get: adminGet('listAdminUsers', 'Admin Users', 'List admin users', 'users.read', pageParams()),
    post: op({
      operationId: 'createAdminUser',
      tags: ['Admin Users'],
      summary: 'Create admin user',
      description: 'Requires `users.create`.',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '409'],
    }),
  },
  '/api/v1/admin/admin-users/{id}': {
    get: adminGet('getAdminUser', 'Admin Users', 'Get admin user', 'users.read', [idParam()]),
    patch: op({
      operationId: 'updateAdminUser',
      tags: ['Admin Users'],
      summary: 'Update admin user profile fields',
      description: 'Requires `users.update`.',
      parameters: [idParam()],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
    delete: op({
      operationId: 'deleteAdminUser',
      tags: ['Admin Users'],
      summary: 'Delete admin user',
      description: 'Requires `users.delete` + `super_admin`.',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/admin/admin-users/{id}/status': {
    patch: op({
      operationId: 'updateAdminUserStatus',
      tags: ['Admin Users'],
      summary: 'Update admin user status',
      description: 'Requires `users.update`.',
      parameters: [idParam()],
      requestBody: jsonBody({
        type: 'object',
        required: ['status'],
        properties: { status: { $ref: '#/components/schemas/AccountStatus' } },
      }),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/admin/admin-users/{id}/role': {
    patch: op({
      operationId: 'updateAdminUserRole',
      tags: ['Admin Users'],
      summary: 'Update admin role / permissions',
      description: 'Requires `super_admin`. Prevents last-super-admin demotion.',
      parameters: [idParam()],
      requestBody: jsonBody({
        type: 'object',
        required: ['role'],
        properties: {
          role: { $ref: '#/components/schemas/AdminRole' },
          permissions: { type: 'array', items: { type: 'string' } },
        },
      }),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },

  // Moderation
  '/api/v1/admin/candidates': {
    get: adminGet('listAdminCandidates', 'Admin Candidates', 'List candidates', 'candidates.read', pageParams()),
  },
  '/api/v1/admin/candidates/{id}': {
    get: adminGet('getAdminCandidate', 'Admin Candidates', 'Get candidate', 'candidates.read', [idParam()]),
  },
  '/api/v1/admin/candidates/{id}/status': {
    patch: op({
      operationId: 'updateAdminCandidateStatus',
      tags: ['Admin Candidates'],
      summary: 'Update candidate account status',
      description: 'Requires `candidates.update`.',
      parameters: [idParam()],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/admin/candidates/{id}/visibility': {
    patch: op({
      operationId: 'updateAdminCandidateVisibility',
      tags: ['Admin Candidates'],
      summary: 'Update profile visibility',
      description: 'Requires `candidates.update`.',
      parameters: [idParam()],
      requestBody: jsonBody({
        type: 'object',
        required: ['profileVisibility'],
        properties: { profileVisibility: { $ref: '#/components/schemas/ProfileVisibility' } },
      }),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },

  '/api/v1/admin/employers': {
    get: adminGet('listAdminEmployers', 'Admin Employers', 'List employers', 'employers.read', pageParams()),
  },
  '/api/v1/admin/employers/{id}': {
    get: adminGet('getAdminEmployer', 'Admin Employers', 'Get employer', 'employers.read', [idParam()]),
  },
  '/api/v1/admin/employers/{id}/status': {
    patch: op({
      operationId: 'updateAdminEmployerStatus',
      tags: ['Admin Employers'],
      summary: 'Update employer status',
      description: 'Requires `employers.update`.',
      parameters: [idParam()],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },

  '/api/v1/admin/companies': {
    get: adminGet('listAdminCompanies', 'Admin Companies', 'List companies', 'companies.read', pageParams()),
  },
  '/api/v1/admin/companies/{id}': {
    get: adminGet('getAdminCompany', 'Admin Companies', 'Get company', 'companies.read', [idParam()]),
  },
  '/api/v1/admin/companies/{id}/status': {
    patch: op({
      operationId: 'updateAdminCompanyStatus',
      tags: ['Admin Companies'],
      summary: 'Update company status',
      description: 'Requires `companies.update`.',
      parameters: [idParam()],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/admin/companies/{id}/verification': {
    patch: op({
      operationId: 'updateAdminCompanyVerification',
      tags: ['Admin Companies'],
      summary: 'Update company verification',
      description: 'Requires `companies.verify`.',
      parameters: [idParam()],
      requestBody: jsonBody({
        type: 'object',
        required: ['verificationStatus'],
        properties: {
          verificationStatus: { $ref: '#/components/schemas/VerificationStatus' },
          note: { type: 'string' },
        },
      }),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },

  '/api/v1/admin/jobs': {
    get: adminGet('listAdminJobs', 'Admin Jobs', 'List jobs', 'jobs.read', [
      ...pageParams(),
      { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/JobStatus' } },
    ]),
  },
  '/api/v1/admin/jobs/{id}': {
    get: adminGet('getAdminJob', 'Admin Jobs', 'Get job', 'jobs.read', [idParam()]),
  },
  '/api/v1/admin/jobs/{id}/status': {
    patch: op({
      operationId: 'updateAdminJobStatus',
      tags: ['Admin Jobs'],
      summary: 'Moderate job status',
      description: 'Requires jobs.approve / jobs.reject / jobs.update as applicable.',
      parameters: [idParam()],
      requestBody: jsonBody({
        type: 'object',
        required: ['status'],
        properties: { status: { $ref: '#/components/schemas/JobStatus' } },
      }),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/admin/jobs/{id}/feature': {
    patch: op({
      operationId: 'featureAdminJob',
      tags: ['Admin Jobs'],
      summary: 'Set job featured flag',
      description: 'Requires `jobs.update`.',
      parameters: [idParam()],
      requestBody: jsonBody({ type: 'object', properties: { featured: { type: 'boolean' } } }),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/admin/jobs/{id}/urgent': {
    patch: op({
      operationId: 'urgentAdminJob',
      tags: ['Admin Jobs'],
      summary: 'Set job urgent flag',
      description: 'Requires `jobs.update`.',
      parameters: [idParam()],
      requestBody: jsonBody({ type: 'object', properties: { urgent: { type: 'boolean' } } }),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },

  '/api/v1/admin/applications': {
    get: adminGet('listAdminApplications', 'Admin Applications', 'List applications (read-only)', 'applications.read', pageParams()),
  },
  '/api/v1/admin/applications/{id}': {
    get: adminGet('getAdminApplication', 'Admin Applications', 'Get application', 'applications.read', [idParam()]),
  },
  '/api/v1/admin/interviews': {
    get: adminGet('listAdminInterviews', 'Admin Interviews', 'List interviews (read-only)', 'interviews.read', pageParams()),
  },
  '/api/v1/admin/interviews/{id}': {
    get: adminGet('getAdminInterview', 'Admin Interviews', 'Get interview', 'interviews.read', [idParam()]),
  },
  '/api/v1/admin/audit-logs': {
    get: adminGet('listAdminAuditLogs', 'Admin Audit Logs', 'List audit logs', 'audit_logs.read', pageParams()),
  },
  '/api/v1/admin/audit-logs/{id}': {
    get: adminGet('getAdminAuditLog', 'Admin Audit Logs', 'Get audit log', 'audit_logs.read', [idParam()]),
  },
};
