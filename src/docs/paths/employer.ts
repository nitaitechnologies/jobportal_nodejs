import type { OpenAPIV3 } from 'openapi-types';
import { idParam, jsonBody, multipartFile, op, pageParams } from '../helpers';

const obj = { type: 'object' as const, additionalProperties: true };

export const employerPaths: OpenAPIV3.PathsObject = {
  '/api/v1/employer/profile': {
    get: op({
      operationId: 'getEmployerProfile',
      tags: ['Employer Profile'],
      summary: 'Get employer profile',
      data: obj,
      errors: ['401', '403'],
    }),
    patch: op({
      operationId: 'updateEmployerProfile',
      tags: ['Employer Profile'],
      summary: 'Update employer profile',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/employer/company': {
    get: op({
      operationId: 'getEmployerCompany',
      tags: ['Employer Company'],
      summary: 'Get own company profile',
      data: obj,
      errors: ['401', '403'],
    }),
    patch: op({
      operationId: 'updateEmployerCompany',
      tags: ['Employer Company'],
      summary: 'Update own company profile',
      description: 'Ownership derived from JWT. Cannot set verificationStatus via this endpoint.',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/employer/company/logo': {
    post: op({
      operationId: 'uploadCompanyLogo',
      tags: ['Files', 'Employer Company'],
      summary: 'Upload company logo',
      requestBody: multipartFile(),
      data: obj,
      errors: ['400', '401', '403'],
    }),
    delete: op({
      operationId: 'deleteCompanyLogo',
      tags: ['Files', 'Employer Company'],
      summary: 'Delete company logo',
      data: obj,
      errors: ['401', '403'],
    }),
  },
  '/api/v1/employer/company/cover-image': {
    post: op({
      operationId: 'uploadCompanyCover',
      tags: ['Files', 'Employer Company'],
      summary: 'Upload company cover image',
      requestBody: multipartFile(),
      data: obj,
      errors: ['400', '401', '403'],
    }),
    delete: op({
      operationId: 'deleteCompanyCover',
      tags: ['Files', 'Employer Company'],
      summary: 'Delete company cover image',
      data: obj,
      errors: ['401', '403'],
    }),
  },

  '/api/v1/employer/jobs': {
    get: op({
      operationId: 'listEmployerJobs',
      tags: ['Employer Jobs'],
      summary: 'List own jobs',
      parameters: [
        ...pageParams(),
        { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/JobStatus' } },
      ],
      data: obj,
      errors: ['400', '401', '403'],
    }),
    post: op({
      operationId: 'createEmployerJob',
      tags: ['Employer Jobs'],
      summary: 'Create job',
      description: 'Subject to subscription entitlements (B20).',
      requestBody: jsonBody({ $ref: '#/components/schemas/JobCreateRequest' }),
      data: obj,
      errors: ['400', '401', '403'],
      responses: {
        '201': {
          description: 'Created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  message: { type: 'string' },
                  data: obj,
                },
              },
            },
          },
        },
      },
    }),
  },
  '/api/v1/employer/jobs/{id}': {
    get: op({
      operationId: 'getEmployerJob',
      tags: ['Employer Jobs'],
      summary: 'Get owned job',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
    patch: op({
      operationId: 'updateEmployerJob',
      tags: ['Employer Jobs'],
      summary: 'Update owned job',
      parameters: [idParam()],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
    delete: op({
      operationId: 'deleteEmployerJob',
      tags: ['Employer Jobs'],
      summary: 'Delete owned job',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/jobs/{id}/publish': {
    patch: op({
      operationId: 'publishEmployerJob',
      tags: ['Employer Jobs'],
      summary: 'Publish job',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/jobs/{id}/pause': {
    patch: op({
      operationId: 'pauseEmployerJob',
      tags: ['Employer Jobs'],
      summary: 'Pause job',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/jobs/{id}/resume': {
    patch: op({
      operationId: 'resumeEmployerJob',
      tags: ['Employer Jobs'],
      summary: 'Resume paused job',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/jobs/{id}/close': {
    patch: op({
      operationId: 'closeEmployerJob',
      tags: ['Employer Jobs'],
      summary: 'Close job',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/jobs/{id}/renew': {
    patch: op({
      operationId: 'renewEmployerJob',
      tags: ['Employer Jobs'],
      summary: 'Renew expired job',
      description:
        'Republishes an expired job for a new listing lifetime. Consumes one jobPostLimit credit.',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404', '409'],
    }),
  },

  '/api/v1/employer/applications': {
    get: op({
      operationId: 'listEmployerApplications',
      tags: ['Employer Applications'],
      summary: 'List applications to own jobs',
      description: 'Private media resume refs are redacted in responses.',
      parameters: [
        ...pageParams(),
        { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/ApplicationStatus' } },
        { name: 'jobId', in: 'query', schema: { $ref: '#/components/schemas/ObjectId' } },
      ],
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/employer/applications/{id}': {
    get: op({
      operationId: 'getEmployerApplication',
      tags: ['Employer Applications'],
      summary: 'Get application (owned company)',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/employer/applications/{id}/status': {
    patch: op({
      operationId: 'updateApplicationStatus',
      tags: ['Employer Applications'],
      summary: 'Update application status',
      parameters: [idParam()],
      requestBody: jsonBody({
        type: 'object',
        required: ['status'],
        properties: {
          status: { $ref: '#/components/schemas/ApplicationStatus' },
          notes: { type: 'string' },
        },
      }),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },

  '/api/v1/employer/interviews': {
    get: op({
      operationId: 'listEmployerInterviews',
      tags: ['Employer Interviews'],
      summary: 'List interviews',
      parameters: [
        ...pageParams(),
        { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/InterviewStatus' } },
      ],
      data: obj,
      errors: ['400', '401', '403'],
    }),
    post: op({
      operationId: 'createInterview',
      tags: ['Employer Interviews'],
      summary: 'Schedule interview',
      requestBody: jsonBody({ $ref: '#/components/schemas/InterviewCreateRequest' }),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/interviews/{id}': {
    get: op({
      operationId: 'getEmployerInterview',
      tags: ['Employer Interviews'],
      summary: 'Get interview',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
    patch: op({
      operationId: 'updateInterview',
      tags: ['Employer Interviews'],
      summary: 'Update interview',
      parameters: [idParam()],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/interviews/{id}/reschedule': {
    patch: op({
      operationId: 'rescheduleInterview',
      tags: ['Employer Interviews'],
      summary: 'Reschedule interview',
      parameters: [idParam()],
      requestBody: jsonBody({
        type: 'object',
        required: ['scheduledAt'],
        properties: {
          scheduledAt: { type: 'string', format: 'date-time' },
          meetingLink: { type: 'string' },
          location: { type: 'string' },
        },
      }),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/interviews/{id}/cancel': {
    patch: op({
      operationId: 'cancelInterview',
      tags: ['Employer Interviews'],
      summary: 'Cancel interview',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/interviews/{id}/complete': {
    patch: op({
      operationId: 'completeInterview',
      tags: ['Employer Interviews'],
      summary: 'Mark interview completed',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },

  '/api/v1/employer/subscription': {
    get: op({
      operationId: 'getEmployerSubscription',
      tags: ['Employer Subscription'],
      summary: 'Current subscription',
      description: 'No payment gateway — plans/entitlements only.',
      data: obj,
      errors: ['401', '403'],
    }),
  },
  '/api/v1/employer/subscription/entitlements': {
    get: op({
      operationId: 'getEmployerEntitlements',
      tags: ['Employer Subscription'],
      summary: 'Current entitlements',
      data: obj,
      errors: ['401', '403'],
    }),
  },
  '/api/v1/employer/subscriptions': {
    get: op({
      operationId: 'listEmployerSubscriptions',
      tags: ['Employer Subscription'],
      summary: 'Subscription history',
      parameters: pageParams(),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/employer/subscription/{id}': {
    get: op({
      operationId: 'getEmployerSubscriptionById',
      tags: ['Employer Subscription'],
      summary: 'Get subscription by id',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/employer/analytics': {
    get: op({
      operationId: 'getEmployerAnalytics',
      tags: ['Employer Analytics'],
      summary: 'Employer self analytics',
      description: 'Scoped to authenticated employer company only.',
      parameters: [
        { name: 'preset', in: 'query', schema: { $ref: '#/components/schemas/AnalyticsDatePreset' } },
        { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
        { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
      ],
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
};
