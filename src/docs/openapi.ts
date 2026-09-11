import type { OpenAPIV3 } from 'openapi-types';
import { env } from '../config/env';
import { components } from './components';
import { buildPaths } from './paths';

const TAGS: OpenAPIV3.TagObject[] = [
  { name: 'Health', description: 'Service health' },
  { name: 'Candidate Auth', description: 'Candidate registration and login' },
  { name: 'Candidate Profile', description: 'Candidate profile and sections' },
  { name: 'Candidate Saved Jobs', description: 'Saved jobs' },
  { name: 'Candidate Applications', description: 'Job applications' },
  { name: 'Candidate Interviews', description: 'Candidate interview actions' },
  { name: 'Employer Auth', description: 'Employer registration and login' },
  { name: 'Employer Profile', description: 'Employer account profile' },
  { name: 'Employer Company', description: 'Employer company profile and media' },
  { name: 'Employer Jobs', description: 'Employer job CRUD and lifecycle' },
  { name: 'Employer Applications', description: 'Applications to employer jobs' },
  { name: 'Employer Interviews', description: 'Interview scheduling' },
  { name: 'Employer Analytics', description: 'Employer self analytics' },
  { name: 'Employer Subscription', description: 'Plans entitlements (no payments)' },
  { name: 'Jobs', description: 'Public job search and detail' },
  { name: 'Categories', description: 'Public categories' },
  { name: 'Locations', description: 'Public location hierarchy' },
  { name: 'Companies', description: 'Public company profiles' },
  { name: 'Career Advice', description: 'Public career articles' },
  { name: 'Reports', description: 'User safety reports' },
  { name: 'Subscriptions', description: 'Public subscription plans' },
  { name: 'Notifications', description: 'In-app notifications' },
  { name: 'Settings', description: 'Public platform settings' },
  { name: 'Files', description: 'Media upload and public streaming' },
  { name: 'Admin Auth', description: 'Admin authentication' },
  { name: 'Admin Users', description: 'Admin user management' },
  { name: 'Admin Candidates', description: 'Candidate moderation' },
  { name: 'Admin Employers', description: 'Employer moderation' },
  { name: 'Admin Companies', description: 'Company moderation' },
  { name: 'Admin Jobs', description: 'Job moderation' },
  { name: 'Admin Applications', description: 'Application oversight' },
  { name: 'Admin Interviews', description: 'Interview oversight' },
  { name: 'Admin Categories', description: 'Category CRUD' },
  { name: 'Admin Locations', description: 'Location CRUD' },
  { name: 'Admin Career Advice', description: 'Article management' },
  { name: 'Admin Reports', description: 'Report moderation' },
  { name: 'Admin Subscriptions', description: 'Plans and assignments' },
  { name: 'Admin Analytics', description: 'Platform analytics' },
  { name: 'Admin Settings', description: 'Platform settings management' },
  { name: 'Admin Audit Logs', description: 'Admin audit trail' },
];

function buildServers(): OpenAPIV3.ServerObject[] {
  const local = `http://localhost:${env.port}`;
  const servers: OpenAPIV3.ServerObject[] = [
    { url: local, description: 'Local development' },
  ];

  if (env.apiPublicUrl && env.apiPublicUrl !== local) {
    servers.push({
      url: env.apiPublicUrl.replace(/\/$/, ''),
      description: env.isProduction ? 'Production' : 'Configured public API host',
    });
  }

  if (env.nodeEnv === 'staging' || process.env.STAGING_API_URL) {
    const staging = process.env.STAGING_API_URL?.replace(/\/$/, '');
    if (staging) {
      servers.push({ url: staging, description: 'Staging' });
    }
  }

  return servers;
}

/**
 * Build the OpenAPI 3.0 document for WorkIndia API (B1–B25).
 * Paths use absolute `/api/v1/...` so the server URL is the host only.
 */
export function buildOpenApiDocument(): OpenAPIV3.Document {
  return {
    openapi: '3.0.3',
    info: {
      title: 'WorkIndia API',
      version: '1.0.0',
      description: [
        'REST API for the WorkIndia job marketplace.',
        '',
        '## Authentication',
        'Use `Authorization: Bearer <accessToken>` from login endpoints.',
        'Roles: **candidate**, **employer**, **admin** (with permission checks).',
        '',
        '## Response envelope',
        'Success: `{ success: true, message, data }`',
        'Error: `{ success: false, message, errors: [] }`',
        '',
        '## Notes',
        '- No payment gateway (subscriptions are plan/entitlement management only).',
        '- Secrets (JWT, MongoDB, storage credentials) are never returned by the API.',
        '- Auth login/register endpoints are rate-limited.',
      ].join('\n'),
      contact: { name: 'WorkIndia API' },
    },
    servers: buildServers(),
    tags: TAGS,
    paths: buildPaths(),
    components,
  };
}

/** Cached document for request handlers (rebuilt when env changes on process restart). */
let cached: OpenAPIV3.Document | null = null;

export function getOpenApiDocument(): OpenAPIV3.Document {
  if (!cached) {
    cached = buildOpenApiDocument();
  }
  return cached;
}

export function resetOpenApiCache(): void {
  cached = null;
}
