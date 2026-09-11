import type { OpenAPIV3 } from 'openapi-types';
import { bearer, emptyOk, idParam, jsonBody, op, pageParams, publicOp, slugParam, standardErrors } from '../helpers';

const obj = { type: 'object' as const, additionalProperties: true };

export const publicAndAuthPaths: OpenAPIV3.PathsObject = {
  '/api/v1/health': {
    get: publicOp({
      operationId: 'getHealth',
      tags: ['Health'],
      summary: 'Health check',
      description: 'Returns service and database connectivity status. No secrets.',
      data: { $ref: '#/components/schemas/HealthData' },
      message: 'API is running',
      errors: ['400'],
      responses: { '200': emptyOk('API is running', 'API is running') },
    }),
  },

  '/api/v1/settings/public': {
    get: publicOp({
      operationId: 'getPublicSettings',
      tags: ['Settings'],
      summary: 'List public platform settings',
      description: 'Only settings with isPublic=true and isActive=true. Never includes secrets.',
      data: {
        type: 'object',
        properties: {
          settings: { type: 'object', additionalProperties: true },
        },
      },
      errors: [],
    }),
  },

  '/api/v1/media/public/{id}': {
    get: {
      ...publicOp({
        operationId: 'getPublicMedia',
        tags: ['Files'],
        summary: 'Stream public media file',
        parameters: [idParam()],
        errors: ['400', '404'],
      }),
      responses: {
        '200': {
          description: 'Binary media stream',
          content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
        },
        ...standardErrors(['400', '404']),
      },
    },
  },

  '/api/v1/jobs': {
    get: publicOp({
      operationId: 'searchJobs',
      tags: ['Jobs'],
      summary: 'Search / list public jobs',
      description: 'Public job search with filters (B12). Page size may be clamped by platform settings.',
      parameters: [
        ...pageParams(),
        { name: 'q', in: 'query', schema: { type: 'string', maxLength: 100 }, description: 'Keyword search' },
        { name: 'category', in: 'query', schema: { type: 'string' } },
        { name: 'categoryId', in: 'query', schema: { $ref: '#/components/schemas/ObjectId' } },
        { name: 'location', in: 'query', schema: { type: 'string' } },
        { name: 'locationId', in: 'query', schema: { $ref: '#/components/schemas/ObjectId' } },
        { name: 'workMode', in: 'query', schema: { $ref: '#/components/schemas/WorkMode' } },
        { name: 'employmentType', in: 'query', schema: { $ref: '#/components/schemas/EmploymentType' } },
        { name: 'experienceMin', in: 'query', schema: { type: 'number' } },
        { name: 'experienceMax', in: 'query', schema: { type: 'number' } },
        { name: 'salaryMin', in: 'query', schema: { type: 'number' } },
        { name: 'salaryMax', in: 'query', schema: { type: 'number' } },
        { name: 'featured', in: 'query', schema: { type: 'boolean' } },
        { name: 'urgent', in: 'query', schema: { type: 'boolean' } },
        {
          name: 'sort',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['latest', 'relevance', 'salary_high', 'salary_low', 'experience_low'],
            default: 'latest',
          },
        },
      ],
      data: obj,
      errors: ['400'],
    }),
  },
  '/api/v1/jobs/{slug}': {
    get: publicOp({
      operationId: 'getJobBySlug',
      tags: ['Jobs'],
      summary: 'Get public job by slug',
      parameters: [slugParam()],
      data: obj,
      errors: ['404'],
    }),
  },

  '/api/v1/categories': {
    get: publicOp({
      operationId: 'listCategories',
      tags: ['Categories'],
      summary: 'List public categories',
      parameters: [
        ...pageParams(),
        { $ref: '#/components/parameters/Search' },
      ],
      data: obj,
      errors: ['400'],
    }),
  },
  '/api/v1/categories/{slug}': {
    get: publicOp({
      operationId: 'getCategoryBySlug',
      tags: ['Categories'],
      summary: 'Get category by slug',
      parameters: [slugParam()],
      data: obj,
      errors: ['404'],
    }),
  },
  '/api/v1/categories/{slug}/subcategories': {
    get: publicOp({
      operationId: 'listCategorySubcategories',
      tags: ['Categories'],
      summary: 'List subcategories',
      parameters: [slugParam()],
      data: obj,
      errors: ['404'],
    }),
  },

  '/api/v1/locations': {
    get: publicOp({
      operationId: 'listLocations',
      tags: ['Locations'],
      summary: 'List public locations',
      parameters: [
        ...pageParams(),
        { $ref: '#/components/parameters/Search' },
        { name: 'type', in: 'query', schema: { $ref: '#/components/schemas/LocationType' } },
      ],
      data: obj,
      errors: ['400'],
    }),
  },
  '/api/v1/locations/{slug}': {
    get: publicOp({
      operationId: 'getLocationBySlug',
      tags: ['Locations'],
      summary: 'Get location by slug',
      parameters: [slugParam()],
      data: obj,
      errors: ['404'],
    }),
  },
  '/api/v1/locations/{slug}/children': {
    get: publicOp({
      operationId: 'listLocationChildren',
      tags: ['Locations'],
      summary: 'List child locations',
      parameters: [slugParam()],
      data: obj,
      errors: ['404'],
    }),
  },

  '/api/v1/companies/{slug}': {
    get: publicOp({
      operationId: 'getCompanyBySlug',
      tags: ['Companies'],
      summary: 'Public company profile by slug',
      parameters: [slugParam()],
      data: obj,
      errors: ['404'],
    }),
  },

  '/api/v1/career-advice': {
    get: publicOp({
      operationId: 'listCareerAdvice',
      tags: ['Career Advice'],
      summary: 'List published career articles',
      parameters: [
        ...pageParams(),
        { name: 'q', in: 'query', schema: { type: 'string', maxLength: 100 } },
        { name: 'category', in: 'query', schema: { type: 'string' } },
        { name: 'tag', in: 'query', schema: { type: 'string' } },
        {
          name: 'sort',
          in: 'query',
          schema: { type: 'string', enum: ['latest', 'popular', 'oldest'] },
        },
      ],
      data: obj,
      errors: ['400'],
    }),
  },
  '/api/v1/career-advice/{slug}': {
    get: publicOp({
      operationId: 'getCareerAdviceBySlug',
      tags: ['Career Advice'],
      summary: 'Get published article by slug',
      parameters: [slugParam()],
      data: obj,
      errors: ['404'],
    }),
  },

  '/api/v1/subscription-plans': {
    get: publicOp({
      operationId: 'listSubscriptionPlans',
      tags: ['Subscriptions'],
      summary: 'List public subscription plans',
      description: 'May return empty when subscriptions.plansPublic is disabled. No payment gateway.',
      parameters: pageParams(),
      data: obj,
      errors: ['400'],
    }),
  },
  '/api/v1/subscription-plans/{slug}': {
    get: publicOp({
      operationId: 'getSubscriptionPlanBySlug',
      tags: ['Subscriptions'],
      summary: 'Get public plan by slug',
      parameters: [slugParam()],
      data: obj,
      errors: ['404'],
    }),
  },

  // --- Auth (public login/register) ---
  '/api/v1/candidate/auth/register': {
    post: {
      ...publicOp({
        operationId: 'candidateRegister',
        tags: ['Candidate Auth'],
        summary: 'Register candidate',
        requestBody: jsonBody({ $ref: '#/components/schemas/CandidateRegisterRequest' }),
        data: { $ref: '#/components/schemas/AuthTokens' },
        errors: ['400', '409', '429'],
      }),
      responses: {
        '201': emptyOk('Registered', 'Registered successfully'),
        ...standardErrors(['400', '409', '429']),
      },
    },
  },
  '/api/v1/candidate/auth/login': {
    post: publicOp({
      operationId: 'candidateLogin',
      tags: ['Candidate Auth'],
      summary: 'Candidate login',
      requestBody: jsonBody({ $ref: '#/components/schemas/LoginRequest' }),
      data: { $ref: '#/components/schemas/AuthTokens' },
      errors: ['400', '401', '429'],
    }),
  },
  '/api/v1/candidate/auth/logout': {
    post: op({
      operationId: 'candidateLogout',
      tags: ['Candidate Auth'],
      summary: 'Candidate logout (client discards token)',
      security: bearer(),
      data: obj,
      errors: ['401', '403'],
    }),
  },
  '/api/v1/candidate/auth/me': {
    get: op({
      operationId: 'candidateMe',
      tags: ['Candidate Auth'],
      summary: 'Current candidate session',
      data: obj,
      errors: ['401', '403'],
    }),
  },

  '/api/v1/employer/auth/register': {
    post: {
      ...publicOp({
        operationId: 'employerRegister',
        tags: ['Employer Auth'],
        summary: 'Register employer + initial company',
        requestBody: jsonBody({ $ref: '#/components/schemas/EmployerRegisterRequest' }),
        data: { $ref: '#/components/schemas/AuthTokens' },
        errors: ['400', '409', '429'],
      }),
      responses: {
        '201': emptyOk('Registered', 'Registered successfully'),
        ...standardErrors(['400', '409', '429']),
      },
    },
  },
  '/api/v1/employer/auth/login': {
    post: publicOp({
      operationId: 'employerLogin',
      tags: ['Employer Auth'],
      summary: 'Employer login',
      requestBody: jsonBody({ $ref: '#/components/schemas/LoginRequest' }),
      data: { $ref: '#/components/schemas/AuthTokens' },
      errors: ['400', '401', '429'],
    }),
  },
  '/api/v1/employer/auth/logout': {
    post: op({
      operationId: 'employerLogout',
      tags: ['Employer Auth'],
      summary: 'Employer logout',
      data: obj,
      errors: ['401', '403'],
    }),
  },
  '/api/v1/employer/auth/me': {
    get: op({
      operationId: 'employerMe',
      tags: ['Employer Auth'],
      summary: 'Current employer session',
      data: obj,
      errors: ['401', '403'],
    }),
  },

  '/api/v1/admin/auth/login': {
    post: publicOp({
      operationId: 'adminLogin',
      tags: ['Admin Auth'],
      summary: 'Admin login',
      requestBody: jsonBody({ $ref: '#/components/schemas/LoginRequest' }),
      data: { $ref: '#/components/schemas/AuthTokens' },
      errors: ['400', '401', '429'],
    }),
  },
  '/api/v1/admin/auth/logout': {
    post: op({
      operationId: 'adminLogout',
      tags: ['Admin Auth'],
      summary: 'Admin logout',
      data: obj,
      errors: ['401', '403'],
    }),
  },
  '/api/v1/admin/auth/me': {
    get: op({
      operationId: 'adminMe',
      tags: ['Admin Auth'],
      summary: 'Current admin session',
      data: obj,
      errors: ['401', '403'],
    }),
  },
};

// Fix health get - publicOp with empty errors still adds 400. Override health properly.
(publicAndAuthPaths['/api/v1/health'] as OpenAPIV3.PathItemObject).get = {
  operationId: 'getHealth',
  tags: ['Health'],
  summary: 'Health check',
  description: 'Returns service and database connectivity status. No secrets.',
  security: [],
  responses: {
    '200': {
      description: 'API is running',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', enum: [true] },
              message: { type: 'string' },
              data: { $ref: '#/components/schemas/HealthData' },
            },
          },
        },
      },
    },
  },
};

// Fix media - publicOp merged poorly; rewrite
(publicAndAuthPaths['/api/v1/media/public/{id}'] as OpenAPIV3.PathItemObject).get = {
  operationId: 'getPublicMedia',
  tags: ['Files'],
  summary: 'Stream public media file',
  security: [],
  parameters: [idParam()],
  responses: {
    '200': {
      description: 'Binary media stream (public visibility only)',
      content: {
        'application/octet-stream': { schema: { type: 'string', format: 'binary' } },
        'image/*': { schema: { type: 'string', format: 'binary' } },
      },
    },
    ...standardErrors(['400', '404']),
  },
};
