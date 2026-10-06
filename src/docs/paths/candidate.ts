import type { OpenAPIV3 } from 'openapi-types';
import { bearer, idParam, jsonBody, multipartFile, op, pageParams } from '../helpers';

const obj = { type: 'object' as const, additionalProperties: true };

function crudList(tag: string, id: string, summary: string): OpenAPIV3.OperationObject {
  return op({
    operationId: id,
    tags: [tag],
    summary,
    parameters: pageParams(),
    data: obj,
    errors: ['400', '401', '403'],
  });
}

export const candidatePaths: OpenAPIV3.PathsObject = {
  '/api/v1/candidate/profile': {
    get: op({
      operationId: 'getCandidateProfile',
      tags: ['Candidate Profile'],
      summary: 'Get own candidate profile',
      data: obj,
      errors: ['401', '403'],
    }),
    patch: op({
      operationId: 'updateCandidateProfile',
      tags: ['Candidate Profile'],
      summary: 'Update own candidate profile',
      description: 'Mass-assignment protected. Role, status, credentials, and ownership fields are rejected.',
      requestBody: jsonBody({ type: 'object', additionalProperties: true }),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/candidate/profile/completion': {
    get: op({
      operationId: 'getCandidateProfileCompletion',
      tags: ['Candidate Profile'],
      summary: 'Profile completion score',
      data: obj,
      errors: ['401', '403'],
    }),
  },
  '/api/v1/candidate/profile/avatar': {
    post: op({
      operationId: 'uploadCandidateAvatar',
      tags: ['Files', 'Candidate Profile'],
      summary: 'Upload candidate avatar',
      description: 'multipart field `file`. Images only; size limited by upload config.',
      requestBody: multipartFile(),
      data: obj,
      errors: ['400', '401', '403'],
    }),
    delete: op({
      operationId: 'deleteCandidateAvatar',
      tags: ['Files', 'Candidate Profile'],
      summary: 'Delete candidate avatar',
      data: obj,
      errors: ['401', '403'],
    }),
  },
  '/api/v1/candidate/profile/resume': {
    post: op({
      operationId: 'uploadCandidateResume',
      tags: ['Files', 'Candidate Profile'],
      summary: 'Upload candidate resume (PDF)',
      requestBody: multipartFile(),
      data: obj,
      errors: ['400', '401', '403'],
    }),
    get: op({
      operationId: 'getCandidateResumeMeta',
      tags: ['Files', 'Candidate Profile'],
      summary: 'Get resume metadata',
      data: obj,
      errors: ['401', '403', '404'],
    }),
    delete: op({
      operationId: 'deleteCandidateResume',
      tags: ['Files', 'Candidate Profile'],
      summary: 'Delete candidate resume',
      data: obj,
      errors: ['401', '403'],
    }),
  },
  '/api/v1/candidate/profile/resume/download': {
    get: {
      operationId: 'downloadCandidateResume',
      tags: ['Files', 'Candidate Profile'],
      summary: 'Download own private resume',
      description: 'Owner-only. Returns binary PDF attachment.',
      security: bearer(),
      responses: {
        '200': {
          description: 'Resume file',
          content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/v1/candidate/profile/resume/ai/build': {
    post: op({
      operationId: 'buildAiResume',
      tags: ['Candidate Profile', 'AI Resume'],
      summary: 'AI resume builder (ChatGPT)',
      description:
        'Generates a resume draft from the candidate profile. Response always includes aiGenerated=true, aiLabel, aiDisclaimer, and uiHint so clients can label content as AI-generated. Requires OPENAI_API_KEY.',
      requestBody: jsonBody({
        type: 'object',
        properties: {
          tone: { type: 'string', enum: ['professional', 'friendly', 'concise'] },
          focusRoles: { type: 'array', items: { type: 'string' }, maxItems: 5 },
        },
      }),
      data: obj,
      errors: ['400', '401', '403', '404', '429'],
    }),
  },
  '/api/v1/candidate/profile/resume/ai/tailor': {
    post: op({
      operationId: 'tailorAiResumeForJob',
      tags: ['Candidate Profile', 'AI Resume'],
      summary: 'AI job-specific resume tailoring (ChatGPT)',
      description:
        'Tailors a resume draft for a specific job. Response always marks content as AI-generated. Requires OPENAI_API_KEY and a valid jobId.',
      requestBody: jsonBody({
        type: 'object',
        required: ['jobId'],
        properties: {
          jobId: { type: 'string' },
          tone: { type: 'string', enum: ['professional', 'friendly', 'concise'] },
        },
      }),
      data: obj,
      errors: ['400', '401', '403', '404', '429'],
    }),
  },
  '/api/v1/candidate/profile/skills': {
    post: op({
      operationId: 'addCandidateSkill',
      tags: ['Candidate Profile'],
      summary: 'Add skill',
      requestBody: jsonBody({ type: 'object', required: ['skill'], properties: { skill: { type: 'string' } } }),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/candidate/profile/skills/{skill}': {
    delete: op({
      operationId: 'removeCandidateSkill',
      tags: ['Candidate Profile'],
      summary: 'Remove skill',
      parameters: [{ name: 'skill', in: 'path', required: true, schema: { type: 'string' } }],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/candidate/profile/education': {
    post: op({
      operationId: 'addCandidateEducation',
      tags: ['Candidate Profile'],
      summary: 'Add education entry',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/candidate/profile/education/{educationId}': {
    patch: op({
      operationId: 'updateCandidateEducation',
      tags: ['Candidate Profile'],
      summary: 'Update education entry',
      parameters: [idParam('educationId')],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
    delete: op({
      operationId: 'deleteCandidateEducation',
      tags: ['Candidate Profile'],
      summary: 'Delete education entry',
      parameters: [idParam('educationId')],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/candidate/profile/experience': {
    post: op({
      operationId: 'addCandidateExperience',
      tags: ['Candidate Profile'],
      summary: 'Add work experience',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/candidate/profile/experience/{experienceId}': {
    patch: op({
      operationId: 'updateCandidateExperience',
      tags: ['Candidate Profile'],
      summary: 'Update work experience',
      parameters: [idParam('experienceId')],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
    delete: op({
      operationId: 'deleteCandidateExperience',
      tags: ['Candidate Profile'],
      summary: 'Delete work experience',
      parameters: [idParam('experienceId')],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/candidate/profile/certifications': {
    post: op({
      operationId: 'addCandidateCertification',
      tags: ['Candidate Profile'],
      summary: 'Add certification',
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/candidate/profile/certifications/{certificationId}': {
    patch: op({
      operationId: 'updateCandidateCertification',
      tags: ['Candidate Profile'],
      summary: 'Update certification',
      parameters: [idParam('certificationId')],
      requestBody: jsonBody(obj),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
    delete: op({
      operationId: 'deleteCandidateCertification',
      tags: ['Candidate Profile'],
      summary: 'Delete certification',
      parameters: [idParam('certificationId')],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },

  '/api/v1/candidate/saved-jobs': {
    get: crudList('Candidate Saved Jobs', 'listSavedJobs', 'List saved jobs'),
  },
  '/api/v1/candidate/saved-jobs/{jobId}': {
    get: op({
      operationId: 'getSavedJob',
      tags: ['Candidate Saved Jobs'],
      summary: 'Check if job is saved',
      parameters: [idParam('jobId')],
      data: obj,
      errors: ['401', '403', '404'],
    }),
    post: op({
      operationId: 'saveJob',
      tags: ['Candidate Saved Jobs'],
      summary: 'Save a job',
      parameters: [idParam('jobId')],
      data: obj,
      errors: ['401', '403', '404', '409'],
    }),
    delete: op({
      operationId: 'unsaveJob',
      tags: ['Candidate Saved Jobs'],
      summary: 'Remove saved job',
      parameters: [idParam('jobId')],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/candidate/saved-jobs/{jobId}/toggle': {
    patch: op({
      operationId: 'toggleSavedJob',
      tags: ['Candidate Saved Jobs'],
      summary: 'Toggle saved job',
      parameters: [idParam('jobId')],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },

  '/api/v1/candidate/saved-searches': {
    get: op({
      operationId: 'listSavedSearches',
      tags: ['Candidate Alerts'],
      summary: 'List saved searches',
      parameters: [
        ...pageParams(),
        { name: 'isActive', in: 'query', schema: { type: 'boolean' } },
      ],
      data: obj,
      errors: ['400', '401', '403'],
    }),
    post: op({
      operationId: 'createSavedSearch',
      tags: ['Candidate Alerts'],
      summary: 'Create saved search (instant/daily/weekly alerts)',
      requestBody: jsonBody({ $ref: '#/components/schemas/SavedSearchCreateRequest' }),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/candidate/saved-searches/alert-settings': {
    get: op({
      operationId: 'getAlertSettings',
      tags: ['Candidate Alerts'],
      summary: 'Get global job alert preferences',
      data: obj,
      errors: ['401', '403'],
    }),
    patch: op({
      operationId: 'updateAlertSettings',
      tags: ['Candidate Alerts'],
      summary: 'Update matching/nearby/salary/hot/deadline/government prefs',
      requestBody: jsonBody({ $ref: '#/components/schemas/AlertSettingsUpdateRequest' }),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/candidate/saved-searches/{id}': {
    get: op({
      operationId: 'getSavedSearch',
      tags: ['Candidate Alerts'],
      summary: 'Get saved search',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
    patch: op({
      operationId: 'updateSavedSearch',
      tags: ['Candidate Alerts'],
      summary: 'Update saved search',
      parameters: [idParam()],
      requestBody: jsonBody({ $ref: '#/components/schemas/SavedSearchUpdateRequest' }),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
    delete: op({
      operationId: 'deleteSavedSearch',
      tags: ['Candidate Alerts'],
      summary: 'Delete saved search',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },

  '/api/v1/candidate/jobs/{jobId}/apply': {
    post: op({
      operationId: 'applyToJob',
      tags: ['Candidate Applications'],
      summary: 'One-tap apply to a job',
      description:
        'Empty body reuses profile resume. Response includes confirmation + APPLICATION_CONFIRMATION notification.',
      parameters: [idParam('jobId')],
      requestBody: jsonBody({ $ref: '#/components/schemas/ApplicationApplyRequest' }),
      data: obj,
      errors: ['400', '401', '403', '404', '409'],
    }),
  },
  '/api/v1/candidate/profile/resumes': {
    get: op({
      operationId: 'listSelectableResumes',
      tags: ['Candidate Profile'],
      summary: 'List selectable resumes for apply',
      data: obj,
      errors: ['401', '403'],
    }),
  },
  '/api/v1/candidate/applications': {
    get: op({
      operationId: 'listCandidateApplications',
      tags: ['Candidate Applications'],
      summary: 'List own applications (history)',
      parameters: [
        ...pageParams(),
        { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/ApplicationStatus' } },
        { name: 'jobId', in: 'query', schema: { $ref: '#/components/schemas/ObjectId' } },
      ],
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/candidate/applications/{id}': {
    get: op({
      operationId: 'getCandidateApplication',
      tags: ['Candidate Applications'],
      summary: 'Get own application (status tracking timestamps included)',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/candidate/applications/{id}/withdraw': {
    patch: op({
      operationId: 'withdrawApplication',
      tags: ['Candidate Applications'],
      summary: 'Withdraw application',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },

  '/api/v1/candidate/invitations': {
    get: op({
      operationId: 'listCandidateInvitations',
      tags: ['Candidate Invitations'],
      summary: 'List recruiter invitations',
      parameters: [
        ...pageParams(),
        { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/InvitationStatus' } },
        { name: 'jobId', in: 'query', schema: { $ref: '#/components/schemas/ObjectId' } },
      ],
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/candidate/invitations/{id}': {
    get: op({
      operationId: 'getCandidateInvitation',
      tags: ['Candidate Invitations'],
      summary: 'Get invitation detail',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/candidate/invitations/{id}/accept': {
    patch: op({
      operationId: 'acceptInvitation',
      tags: ['Candidate Invitations'],
      summary: 'Accept invitation (one-tap apply)',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404', '409'],
    }),
  },
  '/api/v1/candidate/invitations/{id}/decline': {
    patch: op({
      operationId: 'declineInvitation',
      tags: ['Candidate Invitations'],
      summary: 'Decline invitation',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404', '409'],
    }),
  },

  '/api/v1/candidate/interviews': {
    get: op({
      operationId: 'listCandidateInterviews',
      tags: ['Candidate Interviews'],
      summary: 'List own interviews',
      parameters: [
        ...pageParams(),
        { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/InterviewStatus' } },
        {
          name: 'upcoming',
          in: 'query',
          schema: { type: 'boolean' },
          description: 'When true, only active interviews with scheduledAt >= now',
        },
      ],
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/candidate/interviews/{id}': {
    get: op({
      operationId: 'getCandidateInterview',
      tags: ['Candidate Interviews'],
      summary: 'Get own interview',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/candidate/interviews/{id}/confirm': {
    patch: op({
      operationId: 'confirmInterview',
      tags: ['Candidate Interviews'],
      summary: 'Confirm / accept interview',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/candidate/interviews/{id}/decline': {
    patch: op({
      operationId: 'declineInterview',
      tags: ['Candidate Interviews'],
      summary: 'Decline interview',
      parameters: [idParam()],
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/candidate/interviews/{id}/reschedule': {
    patch: op({
      operationId: 'candidateRescheduleInterview',
      tags: ['Candidate Interviews'],
      summary: 'Reschedule interview (candidate proposes new time)',
      parameters: [idParam()],
      requestBody: jsonBody({ $ref: '#/components/schemas/InterviewRescheduleRequest' }),
      data: obj,
      errors: ['400', '401', '403', '404'],
    }),
  },
  '/api/v1/candidate/ai/matches': {
    get: op({
      operationId: 'listAiJobMatches',
      tags: ['Candidate AI'],
      summary: 'AI-assisted candidate↔job matching',
      description:
        'Ranks public jobs using profile skills, experience, salary, location, and availability (match %). Optional ChatGPT blurbs are labelled AI-generated. Requires OPENAI_API_KEY + ENABLE_AI_MATCHING.',
      parameters: [
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
        {
          name: 'minScore',
          in: 'query',
          schema: { type: 'integer', minimum: 0, maximum: 100, default: 40 },
        },
        {
          name: 'withAiInsights',
          in: 'query',
          schema: { type: 'boolean', default: true },
        },
      ],
      data: obj,
      errors: ['401', '403', '404', '429'],
    }),
  },
  '/api/v1/candidate/ai/matches/{jobId}/explain': {
    get: op({
      operationId: 'explainAiJobMatch',
      tags: ['Candidate AI'],
      summary: 'Explain why a job matches (ChatGPT)',
      description:
        'Returns deterministic match breakdown plus an AI explanation. Response always includes aiGenerated labels.',
      parameters: [idParam('jobId')],
      data: obj,
      errors: ['401', '403', '404', '429'],
    }),
  },
  '/api/v1/candidate/ai/career-coach': {
    get: op({
      operationId: 'getAiCareerCoach',
      tags: ['Candidate AI'],
      summary: 'AI Career Coach pack',
      description:
        'Career/job recommendations, salary guidance, and missing-skill suggestions. Includes sponsored role ads matched to those skill gaps. Always labelled AI-generated. Requires OPENAI_API_KEY + ENABLE_AI_CAREER_COACH.',
      data: obj,
      errors: ['401', '403', '404', '429'],
    }),
  },
  '/api/v1/candidate/role-ads': {
    get: op({
      operationId: 'suggestCandidateRoleAds',
      tags: ['Candidate Role Ads'],
      summary: 'Role ads for skill gaps',
      description:
        'Live ads whose roles-master categories match comma-separated skills (example: Next.js). Used by the website and the mobile app.',
      parameters: [
        {
          name: 'skills',
          in: 'query',
          required: true,
          schema: { type: 'string' },
          description: 'Comma-separated skill or role labels',
        },
      ],
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/candidate/role-ads/{id}/click': {
    post: op({
      operationId: 'recordCandidateRoleAdClick',
      tags: ['Candidate Role Ads'],
      summary: 'Record a role ad click',
      description: 'Increments the ad total and this candidate’s click count, then returns the destination link.',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
};
