import type { EmployerTeamRole } from './enums';

/**
 * Company-scoped employer permissions (sheet 162).
 * Distinct from admin PERMISSIONS.
 */
export const EMPLOYER_PERMISSIONS = {
  TEAM_MANAGE: 'employer.team.manage',
  BILLING_MANAGE: 'employer.billing.manage',
  COMPANY_UPDATE: 'employer.company.update',
  JOBS_MANAGE: 'employer.jobs.manage',
  APPLICATIONS_MANAGE: 'employer.applications.manage',
  CANDIDATES_VIEW: 'employer.candidates.view',
  INVITES_MANAGE: 'employer.invites.manage',
} as const;

export type EmployerPermission =
  (typeof EMPLOYER_PERMISSIONS)[keyof typeof EMPLOYER_PERMISSIONS];

const P = EMPLOYER_PERMISSIONS;

export const EMPLOYER_ROLE_PERMISSIONS: Record<EmployerTeamRole, EmployerPermission[]> = {
  owner: [
    P.TEAM_MANAGE,
    P.BILLING_MANAGE,
    P.COMPANY_UPDATE,
    P.JOBS_MANAGE,
    P.APPLICATIONS_MANAGE,
    P.CANDIDATES_VIEW,
    P.INVITES_MANAGE,
  ],
  hr: [
    P.COMPANY_UPDATE,
    P.JOBS_MANAGE,
    P.APPLICATIONS_MANAGE,
    P.CANDIDATES_VIEW,
    P.INVITES_MANAGE,
  ],
  recruiter: [P.JOBS_MANAGE, P.APPLICATIONS_MANAGE, P.CANDIDATES_VIEW],
};

export function permissionsForTeamRole(role: EmployerTeamRole): EmployerPermission[] {
  return [...EMPLOYER_ROLE_PERMISSIONS[role]];
}

export function teamRoleHasPermission(
  role: EmployerTeamRole,
  permission: EmployerPermission,
): boolean {
  return EMPLOYER_ROLE_PERMISSIONS[role].includes(permission);
}
