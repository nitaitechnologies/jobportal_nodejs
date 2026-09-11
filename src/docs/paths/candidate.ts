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

  '/api/v1/candidate/jobs/{jobId}/apply': {
    post: op({
      operationId: 'applyToJob',
      tags: ['Candidate Applications'],
      summary: 'Apply to a job',
      parameters: [idParam('jobId')],
      requestBody: jsonBody({ $ref: '#/components/schemas/ApplicationApplyRequest' }),
      data: obj,
      errors: ['400', '401', '403', '404', '409'],
    }),
  },
  '/api/v1/candidate/applications': {
    get: op({
      operationId: 'listCandidateApplications',
      tags: ['Candidate Applications'],
      summary: 'List own applications',
      parameters: [
        ...pageParams(),
        { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/ApplicationStatus' } },
      ],
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/candidate/applications/{id}': {
    get: op({
      operationId: 'getCandidateApplication',
      tags: ['Candidate Applications'],
      summary: 'Get own application',
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

  '/api/v1/candidate/interviews': {
    get: op({
      operationId: 'listCandidateInterviews',
      tags: ['Candidate Interviews'],
      summary: 'List own interviews',
      parameters: [
        ...pageParams(),
        { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/InterviewStatus' } },
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
      summary: 'Confirm interview',
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
};
