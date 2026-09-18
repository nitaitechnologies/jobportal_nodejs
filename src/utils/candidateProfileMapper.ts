import type { Document } from 'mongoose';
import { env } from '../config/env';
import type { ICandidate } from '../models/Candidate';
import type { IUser } from '../models/User';
import {
  getCandidateProfileCompletionDetails,
  type ProfileCompletionDetails,
} from './candidateProfileCompletion';

type UserDoc = Document & IUser & { _id: { toString(): string } };
type CandidateDoc = Document & ICandidate & { _id: { toString(): string } };

export function mapSafeUserProfile(user: UserDoc) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
    role: user.role,
    avatar: user.avatar ?? '',
  };
}

export function mapSafeCandidateProfile(candidate: CandidateDoc) {
  return {
    id: candidate._id.toString(),
    headline: candidate.headline ?? '',
    bio: candidate.bio ?? '',
    profilePhoto: candidate.profilePhoto ?? '',
    dateOfBirth: candidate.dateOfBirth ?? null,
    gender: candidate.gender ?? null,
    currentLocation: candidate.currentLocation ?? '',
    placeId: candidate.placeId ?? '',
    latitude: typeof candidate.latitude === 'number' ? candidate.latitude : null,
    longitude: typeof candidate.longitude === 'number' ? candidate.longitude : null,
    preferredLocations: candidate.preferredLocations ?? [],
    currentJobTitle: candidate.currentJobTitle ?? '',
    currentCompany: candidate.currentCompany ?? '',
    totalExperience: candidate.totalExperience ?? 0,
    expectedSalary: candidate.expectedSalary ?? null,
    noticePeriod: candidate.noticePeriod ?? 0,
    employmentStatus: candidate.employmentStatus ?? 'looking',
    skills: candidate.skills ?? [],
    education: candidate.education ?? [],
    workExperience: candidate.workExperience ?? [],
    certifications: candidate.certifications ?? [],
    languages: candidate.languages ?? [],
    resume: (() => {
      const value = candidate.resume ?? '';
      if (!value) return '';
      if (value.startsWith('media:')) return '[stored]';
      return value;
    })(),
    hasVideoResume: env.enableVideoResume
      ? Boolean(
          ((candidate as CandidateDoc & { videoResume?: string }).videoResume ?? '').trim(),
        )
      : false,
    portfolio: candidate.portfolio ?? '',
    socialLinks: candidate.socialLinks ?? {},
    profileVisibility: candidate.profileVisibility ?? 'public',
    profileCompletion: candidate.profileCompletion ?? 0,
  };
}

export function mapResumeMetadata(candidate: CandidateDoc) {
  const resume = candidate.resume ?? '';
  const hasResume = resume.trim().length > 0;
  const isPrivateMedia = resume.startsWith('media:');
  return {
    resume: isPrivateMedia ? null : resume,
    hasResume,
  };
}

export function mapVideoResumeMetadata(candidate: CandidateDoc) {
  const videoResume = (candidate as CandidateDoc & { videoResume?: string }).videoResume ?? '';
  const hasVideoResume = videoResume.trim().length > 0;
  return {
    hasVideoResume,
  };
}

export function mapCandidateProfileResponse(
  user: UserDoc,
  candidate: CandidateDoc,
  completion?: ProfileCompletionDetails,
) {
  const details =
    completion ??
    getCandidateProfileCompletionDetails(
      { name: user.name, phone: user.phone, avatar: user.avatar },
      candidate,
    );

  const profile = mapSafeCandidateProfile(candidate);
  profile.profileCompletion = details.percentage;

  return {
    user: mapSafeUserProfile(user),
    /** Alias kept for B7/B14 consumers. */
    candidate: profile,
    profile,
    completion: {
      percentage: details.percentage,
      completedSections: details.completedSections,
      missingSections: details.missingSections,
      missingFields: details.missingFields,
    },
  };
}
