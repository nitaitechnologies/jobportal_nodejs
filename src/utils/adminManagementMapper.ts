import type { AccountStatus, AdminRole, VerificationStatus } from '../constants/enums';
import type { Permission } from '../constants/permissions';

export function mapAdminUserResponse(input: {
  admin: {
    _id: { toString(): string };
    role: AdminRole | string;
    permissions?: string[] | null;
    status: AccountStatus | string;
    lastLoginAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  };
  user: {
    _id: { toString(): string };
    name: string;
    email: string;
    phone?: string | null;
    status: string;
    emailVerified?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  };
}) {
  return {
    id: input.admin._id.toString(),
    userId: input.user._id.toString(),
    name: input.user.name,
    email: input.user.email,
    phone: input.user.phone ?? '',
    role: input.admin.role,
    permissions: (input.admin.permissions ?? []) as Permission[],
    status: input.admin.status,
    userStatus: input.user.status,
    emailVerified: Boolean(input.user.emailVerified),
    lastLoginAt: input.admin.lastLoginAt ?? null,
    createdAt: input.admin.createdAt ?? null,
    updatedAt: input.admin.updatedAt ?? null,
  };
}

export function mapAdminCandidateResponse(input: {
  candidate: {
    _id: { toString(): string };
    headline?: string | null;
    currentLocation?: string | null;
    totalExperience?: number | null;
    employmentStatus?: string | null;
    profileVisibility?: string | null;
    profileCompletion?: number | null;
    skills?: string[] | null;
    createdAt?: Date;
    updatedAt?: Date;
  };
  user: {
    _id: { toString(): string };
    name: string;
    email: string;
    phone?: string | null;
    status: string;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    avatar?: string | null;
    createdAt?: Date;
    lastLoginAt?: Date | null;
  };
}) {
  return {
    id: input.candidate._id.toString(),
    userId: input.user._id.toString(),
    name: input.user.name,
    email: input.user.email,
    phone: input.user.phone ?? '',
    avatar: input.user.avatar ?? '',
    status: input.user.status,
    emailVerified: Boolean(input.user.emailVerified),
    phoneVerified: Boolean(input.user.phoneVerified),
    headline: input.candidate.headline ?? '',
    currentLocation: input.candidate.currentLocation ?? '',
    totalExperience: input.candidate.totalExperience ?? 0,
    employmentStatus: input.candidate.employmentStatus ?? null,
    profileVisibility: input.candidate.profileVisibility ?? 'public',
    profileCompletion: input.candidate.profileCompletion ?? 0,
    skills: input.candidate.skills ?? [],
    lastLoginAt: input.user.lastLoginAt ?? null,
    createdAt: input.candidate.createdAt ?? input.user.createdAt ?? null,
    updatedAt: input.candidate.updatedAt ?? null,
  };
}

export function mapAdminEmployerResponse(input: {
  employer: {
    _id: { toString(): string };
    designation?: string | null;
    status: string;
    verified?: boolean;
    companyId?: { toString(): string } | null;
    createdAt?: Date;
    updatedAt?: Date;
  };
  user: {
    _id: { toString(): string };
    name: string;
    email: string;
    phone?: string | null;
    status: string;
    lastLoginAt?: Date | null;
    createdAt?: Date;
  };
  company?: {
    _id: { toString(): string };
    name: string;
    slug: string;
    status: string;
    verificationStatus: VerificationStatus | string;
  } | null;
}) {
  return {
    id: input.employer._id.toString(),
    userId: input.user._id.toString(),
    name: input.user.name,
    email: input.user.email,
    phone: input.user.phone ?? '',
    designation: input.employer.designation ?? '',
    status: input.employer.status,
    userStatus: input.user.status,
    verified: Boolean(input.employer.verified),
    lastLoginAt: input.user.lastLoginAt ?? null,
    company: input.company
      ? {
          id: input.company._id.toString(),
          name: input.company.name,
          slug: input.company.slug,
          status: input.company.status,
          verificationStatus: input.company.verificationStatus,
        }
      : null,
    createdAt: input.employer.createdAt ?? input.user.createdAt ?? null,
    updatedAt: input.employer.updatedAt ?? null,
  };
}

export function mapAdminCompanyResponse(company: {
  _id: { toString(): string };
  name: string;
  slug: string;
  industry?: string | null;
  companySize?: string | null;
  website?: string | null;
  status: string;
  verificationStatus: string;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: company._id.toString(),
    name: company.name,
    slug: company.slug,
    industry: company.industry ?? '',
    companySize: company.companySize ?? null,
    website: company.website ?? '',
    status: company.status,
    verificationStatus: company.verificationStatus,
    createdAt: company.createdAt ?? null,
    updatedAt: company.updatedAt ?? null,
  };
}
