import { Candidate } from '../models/Candidate';
import { User } from '../models/User';
import { HTTP_STATUS } from '../constants';
import type { AuthenticatedCandidate } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import type { CandidateDocumentSubmitInput } from '../validators/candidateSafety.validator';

export type CandidateDocumentType = 'aadhaar' | 'pan' | 'passport' | 'other';

/**
 * Candidate document + verified badge (sheet 147–148).
 * Badge = verificationStatus verified OR phone verified (clear, client-safe rule).
 */
export class CandidateVerificationService {
  async getStatus(candidate: AuthenticatedCandidate) {
    const [user, profile] = await Promise.all([
      User.findById(candidate.userId).select('phoneVerified emailVerified'),
      Candidate.findById(candidate.candidateId),
    ]);
    if (!user || !profile) {
      throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    }

    const verificationStatus =
      (profile as typeof profile & { verificationStatus?: string }).verificationStatus ??
      'unverified';
    const documents =
      (
        profile as typeof profile & {
          documents?: Array<{
            type: string;
            mediaUrl: string;
            status: string;
            submittedAt?: Date;
            reviewedAt?: Date | null;
            rejectionReason?: string;
          }>;
        }
      ).documents ?? [];

    const phoneVerified = Boolean(user.phoneVerified);
    const emailVerified = Boolean(user.emailVerified);
    const verifiedBadge = verificationStatus === 'verified' || phoneVerified;

    return {
      verificationStatus,
      verifiedBadge,
      phoneVerified,
      emailVerified,
      documents: documents.map((doc) => ({
        type: doc.type,
        status: doc.status,
        submittedAt: doc.submittedAt ?? null,
        reviewedAt: doc.reviewedAt ?? null,
        rejectionReason: doc.rejectionReason ?? '',
        // Never expose raw media URL to list consumers casually — mark presence only
        hasFile: Boolean(doc.mediaUrl?.trim()),
      })),
    };
  }

  async submitDocument(candidate: AuthenticatedCandidate, input: CandidateDocumentSubmitInput) {
    const profile = await Candidate.findById(candidate.candidateId);
    if (!profile) {
      throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    }

    const existing =
      (
        profile as typeof profile & {
          documents?: Array<{
            type: string;
            mediaUrl: string;
            status: string;
            submittedAt?: Date;
            reviewedAt?: Date | null;
            rejectionReason?: string;
          }>;
        }
      ).documents ?? [];

    const nextDocs = existing
      .filter((d) => d.type !== input.type)
      .map((d) => ({
        type: d.type,
        mediaUrl: d.mediaUrl,
        status: d.status,
        submittedAt: d.submittedAt ?? new Date(),
        reviewedAt: d.reviewedAt ?? null,
        rejectionReason: d.rejectionReason ?? '',
      }));

    nextDocs.push({
      type: input.type,
      mediaUrl: input.mediaUrl,
      status: 'pending',
      submittedAt: new Date(),
      reviewedAt: null,
      rejectionReason: '',
    });

    profile.set('documents', nextDocs);
    const current =
      (profile as typeof profile & { verificationStatus?: string }).verificationStatus ??
      'unverified';
    if (current !== 'verified') {
      profile.set('verificationStatus', 'pending');
    }
    await profile.save();

    return this.getStatus(candidate);
  }
}

export const candidateVerificationService = new CandidateVerificationService();
