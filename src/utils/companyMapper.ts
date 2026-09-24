import type { Document } from 'mongoose';
import type { ICompany } from '../models/Company';
import type { IEmployer } from '../models/Employer';
import type { IUser } from '../models/User';
import { calculateCompanyProfileCompletion } from './companyProfileCompletion';

type UserDoc = Document & IUser & { _id: { toString(): string } };
type EmployerDoc = Document & IEmployer & { _id: { toString(): string } };
type CompanyDoc = Document & ICompany & { _id: { toString(): string } };

export type CompanyGalleryItem = {
  url: string;
  type: 'image' | 'video';
  caption: string;
  sortOrder: number;
};

function mapGallery(company: CompanyDoc): CompanyGalleryItem[] {
  const raw = (company.gallery ?? []) as Array<{
    url?: string;
    type?: string;
    caption?: string;
    sortOrder?: number;
  }>;
  return raw
    .filter((item) => typeof item.url === 'string' && item.url.trim())
    .map((item, index): CompanyGalleryItem => ({
      url: item.url!.trim(),
      type: item.type === 'video' ? 'video' : 'image',
      caption: item.caption?.trim() ?? '',
      sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : index,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function mapBenefits(company: CompanyDoc): string[] {
  return (company.benefits ?? []).map((b) => String(b).trim()).filter(Boolean);
}

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
  const pan = String((company as CompanyDoc & { pan?: string }).pan ?? '').trim();
  const gstin = String((company as CompanyDoc & { gstin?: string }).gstin ?? '').trim();
  const documents = ((company as CompanyDoc & { documents?: Array<{
    type: string;
    mediaUrl: string;
    status: string;
    submittedAt?: Date;
    reviewedAt?: Date | null;
    rejectionReason?: string;
  }> }).documents ?? []);

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
    benefits: mapBenefits(company),
    gallery: mapGallery(company),
    ratingAvg: company.ratingAvg ?? 0,
    ratingCount: company.ratingCount ?? 0,
    /** Presence only — full values via /employer/company/verification */
    hasPan: Boolean(pan),
    hasGstin: Boolean(gstin),
    documents: documents.map((doc) => ({
      type: doc.type,
      status: doc.status,
      submittedAt: doc.submittedAt ?? null,
      reviewedAt: doc.reviewedAt ?? null,
      rejectionReason: doc.rejectionReason ?? '',
      hasFile: Boolean(doc.mediaUrl?.trim()),
    })),
    verificationStatus: company.verificationStatus,
    status: company.status,
    profileCompletion: calculateCompanyProfileCompletion(company),
  };
}

/**
 * Conservative public company payload.
 * Omits private contact details.
 */
export function mapPublicCompany(
  company: CompanyDoc,
  extras?: { openJobsCount?: number },
) {
  const verificationStatus = company.verificationStatus;
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
    benefits: mapBenefits(company),
    gallery: mapGallery(company),
    ratingAvg: Number(company.ratingAvg ?? 0),
    ratingCount: Number(company.ratingCount ?? 0),
    verificationStatus,
    verified: verificationStatus === 'verified',
    featured: Boolean(company.featured),
    openJobsCount: extras?.openJobsCount ?? 0,
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
