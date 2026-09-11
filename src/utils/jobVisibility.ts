import { isCompanyPubliclyVisible } from './companyMapper';

export interface JobVisibilityFields {
  status?: string | null;
  deletedAt?: Date | null;
  expiresAt?: Date | null;
}

/**
 * Same public eligibility used by GET /jobs, GET /jobs/:slug, and saved-job writes.
 */
export function isJobPubliclyVisible(
  job: JobVisibilityFields,
  company: { status?: string | null; verificationStatus?: string | null } | null | undefined,
  now = new Date(),
): boolean {
  if (!job || job.status !== 'published' || job.deletedAt) {
    return false;
  }
  if (job.expiresAt && job.expiresAt.getTime() <= now.getTime()) {
    return false;
  }
  if (!company || !isCompanyPubliclyVisible(company)) {
    return false;
  }
  return true;
}
