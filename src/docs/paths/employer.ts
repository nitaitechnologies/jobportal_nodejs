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
  '/api/v1/employer/jobs/{id}/extend': {
    patch: op({
      operationId: 'extendEmployerJob',
      tags: ['Employer Jobs'],
      summary: 'Extend listing window',
      description:
        'Adds days to expiresAt (and applicationDeadline when set) without consuming a renew credit. Body: `{ days?: 1-90 }`.',
      parameters: [idParam()],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404', '409'],
    }),
  },
  '/api/v1/employer/jobs/{id}/expire': {
    patch: op({
      operationId: 'expireEmployerJob',
      tags: ['Employer Jobs'],
      summary: 'Expire job early',
      description: 'Marks a published or paused job as expired (stops public visibility).',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404', '409'],
    }),
  },
  '/api/v1/employer/jobs/{id}/republish': {
    patch: op({
      operationId: 'republishEmployerJob',
      tags: ['Employer Jobs'],
      summary: 'Republish paused or expired job',
      description: 'Resumes paused jobs, or renews expired jobs (one post credit).',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404', '409'],
    }),
  },
  '/api/v1/employer/jobs/{id}/feature': {
    patch: op({
      operationId: 'featureEmployerJob',
      tags: ['Employer Jobs'],
      summary: 'Boost / toggle featured flag',
      description:
        'Body: `{ featured: boolean }`. Turning featured on boosts a published job and sends an in-app notification to matching candidates. Uses a plan featured slot, or wallet credits when the slot limit is used up.',
      parameters: [idParam()],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404', '409'],
    }),
  },
  '/api/v1/employer/jobs/{id}/urgent': {
    patch: op({
      operationId: 'urgentEmployerJob',
      tags: ['Employer Jobs'],
      summary: 'Toggle urgent hiring flag',
      description: 'Body: `{ urgent: boolean }`.',
      parameters: [idParam()],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404', '409'],
    }),
  },
  '/api/v1/employer/jobs/{id}/duplicate': {
    post: op({
      operationId: 'duplicateEmployerJob',
      tags: ['Employer Jobs'],
      summary: 'Duplicate job as draft',
      description: 'Clones an owned job into a new draft (no metrics/lifecycle copy).',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/jobs/{id}/matches': {
    get: op({
      operationId: 'listEmployerJobCandidateMatches',
      tags: ['Employer AI Matching'],
      summary: 'Rank candidates against job JD',
      description:
        'Scores skills/experience/salary/location/availability, returns match %, matching/missing skills, reasons, and rank. Optional withAiInsights=true for ChatGPT blurbs.',
      parameters: [
        idParam(),
        ...pageParams(),
        { name: 'minScore', in: 'query', schema: { type: 'integer', minimum: 0, maximum: 100 } },
        { name: 'withAiInsights', in: 'query', schema: { type: 'boolean' } },
      ],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/jobs/{id}/matches/{candidateId}/explain': {
    get: op({
      operationId: 'explainEmployerJobCandidateMatch',
      tags: ['Employer AI Matching'],
      summary: 'Explain why a candidate matches this JD',
      parameters: [
        idParam(),
        { name: 'candidateId', in: 'path', required: true, schema: { $ref: '#/components/schemas/ObjectId' } },
      ],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },

  '/api/v1/employer/candidates': {
    get: op({
      operationId: 'listEmployerCandidates',
      tags: ['Employer Candidates'],
      summary: 'Search candidate database',
      description:
        'Filters: q, skill(s), location, lat/lng/radiusKm, experience, education, salary, jobType, workMode, availableBy, noticePeriodMax, language, isFresher, openToWork, jobId.',
      parameters: [...pageParams()],
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/employer/candidates/{id}': {
    get: op({
      operationId: 'getEmployerCandidate',
      tags: ['Employer Candidates'],
      summary: 'View candidate profile',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/candidates/{id}/unlock-contact': {
    post: op({
      operationId: 'unlockEmployerCandidateContact',
      tags: ['Employer Candidates'],
      summary: 'Unlock candidate contact (credits)',
      description:
        'Requires plan feature candidateContact and remaining contactUnlockLimit. Deducts 1 credit on first unlock.',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/candidates/folders': {
    get: op({
      operationId: 'listTalentPoolFolders',
      tags: ['Employer Candidates'],
      summary: 'List talent pool folders',
      data: obj,
      errors: ['401', '403'],
    }),
    post: op({
      operationId: 'createTalentPoolFolder',
      tags: ['Employer Candidates'],
      summary: 'Create talent pool folder',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/employer/candidates/recontacts': {
    get: op({
      operationId: 'listRecontactReminders',
      tags: ['Employer Candidates'],
      summary: 'List future vacancy re-contact reminders',
      data: obj,
      errors: ['401', '403'],
    }),
    post: op({
      operationId: 'scheduleRecontactReminder',
      tags: ['Employer Candidates'],
      summary: 'Schedule re-contact',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },

  '/api/v1/employer/applications': {
    get: op({
      operationId: 'listEmployerApplications',
      tags: ['Employer Applications'],
      summary: 'List applications to own jobs (ATS applicant list)',
      description:
        'Private media resume refs are redacted. Supports status, jobId, and keyword `q` search.',
      parameters: [
        ...pageParams(),
        { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/ApplicationStatus' } },
        { name: 'jobId', in: 'query', schema: { $ref: '#/components/schemas/ObjectId' } },
        { name: 'q', in: 'query', schema: { type: 'string', maxLength: 120 } },
      ],
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/employer/applications/stats': {
    get: op({
      operationId: 'getEmployerApplicationStats',
      tags: ['Employer Applications'],
      summary: 'Stage candidate counts for ATS pipeline',
      parameters: [
        { name: 'jobId', in: 'query', schema: { $ref: '#/components/schemas/ObjectId' } },
      ],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/applications/bulk-status': {
    post: op({
      operationId: 'bulkUpdateApplicationStatus',
      tags: ['Employer Applications'],
      summary: 'Bulk move applications to a stage',
      requestBody: jsonBody({
        type: 'object',
        required: ['ids', 'status'],
        properties: {
          ids: { type: 'array', items: { $ref: '#/components/schemas/ObjectId' }, maxItems: 50 },
          status: { $ref: '#/components/schemas/ApplicationStatus' },
        },
      }),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/employer/applications/{id}': {
    get: op({
      operationId: 'getEmployerApplication',
      tags: ['Employer Applications'],
      summary: 'Get application (owned company) with history and notes',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/employer/applications/{id}/status': {
    patch: op({
      operationId: 'updateApplicationStatus',
      tags: ['Employer Applications'],
      summary: 'Update application status / move stage',
      parameters: [idParam()],
      requestBody: jsonBody({
        type: 'object',
        required: ['status'],
        properties: {
          status: { $ref: '#/components/schemas/ApplicationStatus' },
        },
      }),
      data: obj,
      errors: ['400', '401', '403', '404', '409'],
    }),
  },
  '/api/v1/employer/applications/{id}/notes': {
    post: op({
      operationId: 'addApplicationNote',
      tags: ['Employer Applications'],
      summary: 'Add internal ATS note',
      parameters: [idParam()],
      requestBody: jsonBody({
        type: 'object',
        required: ['text'],
        properties: { text: { type: 'string', maxLength: 5000 } },
      }),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/applications/{id}/notes/{noteId}': {
    patch: op({
      operationId: 'updateApplicationNote',
      tags: ['Employer Applications'],
      summary: 'Update internal ATS note',
      parameters: [
        idParam(),
        { name: 'noteId', in: 'path', required: true, schema: { $ref: '#/components/schemas/ObjectId' } },
      ],
      requestBody: jsonBody({
        type: 'object',
        required: ['text'],
        properties: { text: { type: 'string', maxLength: 5000 } },
      }),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
    delete: op({
      operationId: 'deleteApplicationNote',
      tags: ['Employer Applications'],
      summary: 'Delete internal ATS note',
      parameters: [
        idParam(),
        { name: 'noteId', in: 'path', required: true, schema: { $ref: '#/components/schemas/ObjectId' } },
      ],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },

  '/api/v1/employer/invitations': {
    get: op({
      operationId: 'listEmployerInvitations',
      tags: ['Employer Invitations'],
      summary: 'List sent invitations',
      parameters: [
        ...pageParams(),
        { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/InvitationStatus' } },
        { name: 'jobId', in: 'query', schema: { $ref: '#/components/schemas/ObjectId' } },
      ],
      data: obj,
      errors: ['400', '401', '403'],
    }),
    post: op({
      operationId: 'createInvitation',
      tags: ['Employer Invitations'],
      summary: 'Invite a candidate to apply',
      requestBody: jsonBody({ $ref: '#/components/schemas/InvitationCreateRequest' }),
      data: obj,
      errors: ['400', '401', '403', '404', '409'],
    }),
  },
  '/api/v1/employer/invitations/{id}/cancel': {
    patch: op({
      operationId: 'cancelInvitation',
      tags: ['Employer Invitations'],
      summary: 'Cancel a pending invitation',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404', '409'],
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

  '/api/v1/employer/credit-packs': {
    get: op({
      operationId: 'listCreditPacks',
      tags: ['Employer Payments'],
      summary: 'List purchasable credit packs',
      data: obj,
      errors: ['401', '403'],
    }),
  },
  '/api/v1/employer/wallet': {
    get: op({
      operationId: 'getEmployerWallet',
      tags: ['Employer Payments'],
      summary: 'Company wallet balance',
      data: obj,
      errors: ['401', '403'],
    }),
  },
  '/api/v1/employer/wallet/transactions': {
    get: op({
      operationId: 'listWalletTransactions',
      tags: ['Employer Payments'],
      summary: 'Wallet transaction history',
      parameters: pageParams(),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/employer/invoices': {
    get: op({
      operationId: 'listEmployerInvoices',
      tags: ['Employer Payments'],
      summary: 'GST invoice list',
      parameters: pageParams(),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/employer/invoices/{id}': {
    get: op({
      operationId: 'getEmployerInvoice',
      tags: ['Employer Payments'],
      summary: 'Get GST invoice',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/employer/payments': {
    get: op({
      operationId: 'listEmployerPayments',
      tags: ['Employer Payments'],
      summary: 'Payment history',
      parameters: pageParams(),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/employer/payments/checkout': {
    post: op({
      operationId: 'checkoutEmployerPayment',
      tags: ['Employer Payments'],
      summary: 'Create pending payment (simulated — no live gateway)',
      description:
        'Creates a pending subscription or credit-pack payment with GST. Confirm via /confirm until gateway (358) is added.',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/payments/{id}': {
    get: op({
      operationId: 'getEmployerPayment',
      tags: ['Employer Payments'],
      summary: 'Payment status detail',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/employer/payments/{id}/confirm': {
    post: op({
      operationId: 'confirmEmployerPayment',
      tags: ['Employer Payments'],
      summary: 'Confirm simulated payment',
      description: 'Activates subscription or credits wallet and issues GST invoice.',
      parameters: [idParam()],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/payments/{id}/fail': {
    post: op({
      operationId: 'failEmployerPayment',
      tags: ['Employer Payments'],
      summary: 'Mark payment failed (simulated decline)',
      parameters: [idParam()],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
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

  '/api/v1/employer/ai/jd/improve': {
    post: op({
      operationId: 'employerAiImproveJd',
      tags: ['Employer AI Recruitment'],
      summary: 'Create/improve JD with ChatGPT',
      description: 'Always labelled AI-generated (sheet 293).',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404', '429'],
    }),
  },
  '/api/v1/employer/ai/skills/suggest': {
    post: op({
      operationId: 'employerAiSuggestSkills',
      tags: ['Employer AI Recruitment'],
      summary: 'Suggest skills for a role',
      description: 'Sheet 294. Response marked AI-generated.',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404', '429'],
    }),
  },
  '/api/v1/employer/ai/candidates/screen': {
    post: op({
      operationId: 'employerAiScreenCandidates',
      tags: ['Employer AI Recruitment'],
      summary: 'AI-screen applicants for a job',
      description: 'Sheet 295.',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404', '429'],
    }),
  },
  '/api/v1/employer/ai/profiles/summarize': {
    post: op({
      operationId: 'employerAiSummarizeProfile',
      tags: ['Employer AI Recruitment'],
      summary: 'Summarize a candidate profile',
      description: 'Sheet 296.',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404', '429'],
    }),
  },
  '/api/v1/employer/ai/candidates/suggest': {
    post: op({
      operationId: 'employerAiSuggestCandidates',
      tags: ['Employer AI Recruitment'],
      summary: 'Suggest candidates for a JD',
      description: 'Sheet 297 — ranks with AI insights.',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404', '429'],
    }),
  },
  '/api/v1/employer/ai/interview/questions': {
    post: op({
      operationId: 'employerAiGenerateInterviewQuestions',
      tags: ['Employer AI Recruitment'],
      summary: 'Generate or regenerate interview questions',
      description: 'Sheets 298, 301–303. Pass regenerate=true for a fresh set.',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404', '429'],
    }),
  },
  '/api/v1/employer/ai/interview/questions/save': {
    put: op({
      operationId: 'employerAiSaveInterviewQuestions',
      tags: ['Employer AI Recruitment'],
      summary: 'Save AI interview questions on a job',
      description: 'Sheet 303.',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404', '429'],
    }),
  },
  '/api/v1/employer/ai/interview/questions/{jobId}': {
    get: op({
      operationId: 'employerAiGetSavedInterviewQuestions',
      tags: ['Employer AI Recruitment'],
      summary: 'Get saved AI interview kit for a job',
      parameters: [
        {
          name: 'jobId',
          in: 'path',
          required: true,
          schema: { $ref: '#/components/schemas/ObjectId' },
        },
      ],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/employer/ai/messages/selection': {
    post: op({
      operationId: 'employerAiSelectionMessage',
      tags: ['Employer AI Recruitment'],
      summary: 'Generate selection / shortlist message',
      description: 'Sheet 299.',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404', '429'],
    }),
  },
  '/api/v1/employer/ai/messages/rejection': {
    post: op({
      operationId: 'employerAiRejectionMessage',
      tags: ['Employer AI Recruitment'],
      summary: 'Generate rejection message',
      description: 'Sheet 300.',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404', '429'],
    }),
  },
};
