import type { Document } from 'mongoose';
import type { ICompany } from '../models/Company';
import type { IEmployer } from '../models/Employer';
import type { IUser } from '../models/User';
import { calculateCompanyProfileCompletion } from './companyProfileCompletion';

type UserDoc = Document & IUser & { _id: { toString(): string } };
type EmployerDoc = Document & IEmployer & { _id: { toString(): string } };
type CompanyDoc = Document & ICompany & { _id: { toString(): string } };

export function mapSafeEmployerProfile(user: UserDoc, employer: EmployerDoc) {
  return {
    employer: {
      id: employer._id.toString(),
      userId: user._id.toString(),
      companyId: employer.companyId ? employer.companyId.toString() : null,
      designation: employer.designation ?? '',
      department: employer.department ?? '',
      status: employer.status,
      verified: employer.verified ?? false,
    },
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      role: user.role,
      avatar: user.avatar ?? '',
    },
  };
}

export function mapEmployerOwnedCompany(company: CompanyDoc) {
  return {
    id: company._id.toString(),
    name: company.name,
    slug: company.slug,
    logo: company.logo ?? '',
    coverImage: company.coverImage ?? '',
    description: company.description ?? '',
    website: company.website ?? '',
    industry: company.industry ?? '',
    companySize: company.companySize ?? null,
    foundedYear: company.foundedYear ?? null,
    headquarters: company.headquarters ?? '',
    locations: company.locations ?? [],
    contactEmail: company.contactEmail ?? '',
    contactPhone: company.contactPhone ?? '',
    socialLinks: company.socialLinks ?? {},
    verificationStatus: company.verificationStatus,
    status: company.status,
    profileCompletion: calculateCompanyProfileCompletion(company),
  };
}

/**
 * Conservative public company payload.
 * Omits private contact details.
 */
export function mapPublicCompany(company: CompanyDoc) {
  return {
    id: company._id.toString(),
    name: company.name,
    slug: company.slug,
    logo: company.logo ?? '',
    coverImage: company.coverImage ?? '',
    description: company.description ?? '',
    website: company.website ?? '',
    industry: company.industry ?? '',
    companySize: company.companySize ?? null,
    foundedYear: company.foundedYear ?? null,
    headquarters: company.headquarters ?? '',
    locations: company.locations ?? [],
    socialLinks: company.socialLinks ?? {},
    verificationStatus: company.verificationStatus,
  };
}

/**
 * Public visibility rule (B8):
 * - company.status must be active
 * - verificationStatus must not be rejected
 */
export function isCompanyPubliclyVisible(company: {
  status?: string | null;
  verificationStatus?: string | null;
}): boolean {
  return company.status === 'active' && company.verificationStatus !== 'rejected';
}
