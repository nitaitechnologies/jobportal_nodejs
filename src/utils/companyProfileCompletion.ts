import type { ICompany } from '../models/Company';

type CompanyLike = Partial<ICompany> & {
  socialLinks?: {
    linkedin?: string | null;
    twitter?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    github?: string | null;
    website?: string | null;
  } | null;
};

const WEIGHTS = {
  name: 10,
  description: 15,
  logo: 10,
  website: 10,
  industry: 10,
  companySize: 10,
  headquarters: 10,
  locations: 10,
  contactEmail: 5,
  contactPhone: 5,
  socialLinks: 5,
} as const;

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function hasSocialLink(links: CompanyLike['socialLinks']): boolean {
  if (!links) {
    return false;
  }
  return Object.values(links).some((value) => hasText(value));
}

/**
 * Deterministic company profile completeness score (0–100).
 */
export function calculateCompanyProfileCompletion(company: CompanyLike): number {
  let score = 0;

  if (hasText(company.name)) score += WEIGHTS.name;
  if (hasText(company.description)) score += WEIGHTS.description;
  if (hasText(company.logo)) score += WEIGHTS.logo;
  if (hasText(company.website)) score += WEIGHTS.website;
  if (hasText(company.industry)) score += WEIGHTS.industry;
  if (hasText(company.companySize)) score += WEIGHTS.companySize;
  if (hasText(company.headquarters)) score += WEIGHTS.headquarters;
  if (hasItems(company.locations)) score += WEIGHTS.locations;
  if (hasText(company.contactEmail)) score += WEIGHTS.contactEmail;
  if (hasText(company.contactPhone)) score += WEIGHTS.contactPhone;
  if (hasSocialLink(company.socialLinks)) score += WEIGHTS.socialLinks;

  return Math.min(100, Math.max(0, score));
}
