import { Company } from '../models/Company';
import { HTTP_STATUS } from '../constants';
import type { AuthenticatedEmployer } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import type {
  CompanyDocumentType,
  CompanyVerificationDetailsInput,
} from '../validators/companyVerification.validator';

type CompanyDocRow = {
  type: string;
  mediaUrl: string;
  status: string;
  submittedAt?: Date;
  reviewedAt?: Date | null;
  rejectionReason?: string;
};

function maskPan(pan: string): string {
  const trimmed = pan.trim().toUpperCase();
  if (trimmed.length < 4) return trimmed ? '****' : '';
  return `${trimmed.slice(0, 2)}******${trimmed.slice(-2)}`;
}

function maskGstin(gstin: string): string {
  const trimmed = gstin.trim().toUpperCase();
  if (trimmed.length < 6) return trimmed ? '****' : '';
  return `${trimmed.slice(0, 4)}*******${trimmed.slice(-4)}`;
}

function mapDocuments(docs: CompanyDocRow[]) {
  return docs.map((doc) => ({
    type: doc.type,
    status: doc.status,
    submittedAt: doc.submittedAt ?? null,
    reviewedAt: doc.reviewedAt ?? null,
    rejectionReason: doc.rejectionReason ?? '',
    hasFile: Boolean(doc.mediaUrl?.trim()),
  }));
}

/**
 * Employer company KYC — PAN/GST + document upload (sheet 176–177).
 * Admin approve/reject remains on existing company verification endpoint.
 */
export class CompanyVerificationService {
  async getStatus(employer: AuthenticatedEmployer) {
    const company = await Company.findById(employer.companyId);
    if (!company) throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);

    const documents = (company.documents ?? []) as CompanyDocRow[];
    const pan = (company.pan ?? '').trim();
    const gstin = (company.gstin ?? '').trim();

    return {
      verificationStatus: company.verificationStatus,
      verifiedBadge: company.verificationStatus === 'verified',
      pan: pan ? maskPan(pan) : '',
      gstin: gstin ? maskGstin(gstin) : '',
      hasPan: Boolean(pan),
      hasGstin: Boolean(gstin),
      documents: mapDocuments(documents),
    };
  }

  async updateDetails(employer: AuthenticatedEmployer, input: CompanyVerificationDetailsInput) {
    const company = await Company.findById(employer.companyId);
    if (!company) throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);

    if (input.pan !== undefined) {
      company.pan = input.pan;
    }
    if (input.gstin !== undefined) {
      company.gstin = input.gstin;
    }

    const current = company.verificationStatus;
    if (current !== 'verified' && (company.pan || company.gstin)) {
      company.verificationStatus = 'pending';
    }

    await company.save();
    return this.getStatus(employer);
  }

  async attachDocument(
    employer: AuthenticatedEmployer,
    type: CompanyDocumentType,
    mediaUrl: string,
  ) {
    const company = await Company.findById(employer.companyId);
    if (!company) throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);

    const existing = ((company.documents ?? []) as CompanyDocRow[]).map((d) => ({
      type: d.type,
      mediaUrl: d.mediaUrl,
      status: d.status,
      submittedAt: d.submittedAt ?? new Date(),
      reviewedAt: d.reviewedAt ?? null,
      rejectionReason: d.rejectionReason ?? '',
    }));

    const nextDocs = existing.filter((d) => d.type !== type);
    nextDocs.push({
      type,
      mediaUrl,
      status: 'pending',
      submittedAt: new Date(),
      reviewedAt: null,
      rejectionReason: '',
    });

    company.set('documents', nextDocs);
    if (company.verificationStatus !== 'verified') {
      company.verificationStatus = 'pending';
    }
    await company.save();

    return { status: await this.getStatus(employer) };
  }
}

export const companyVerificationService = new CompanyVerificationService();
