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
  const phoneVerified = Boolean(user.phoneVerified);
  const emailVerified = Boolean(user.emailVerified);
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
    role: user.role,
    avatar: user.avatar ?? '',
    phoneVerified,
    emailVerified,
  };
}

export function mapSafeCandidateProfile(candidate: CandidateDoc) {
  const dob = candidate.dateOfBirth ?? null;
  const verificationStatus =
    (candidate as CandidateDoc & { verificationStatus?: string }).verificationStatus ??
    'unverified';
  return {
    id: candidate._id.toString(),
    headline: candidate.headline ?? '',
    bio: candidate.bio ?? '',
    profilePhoto: candidate.profilePhoto ?? '',
    dateOfBirth: dob,
    age: ageFromDob(dob),
    gender: candidate.gender ?? null,
    currentLocation: candidate.currentLocation ?? '',
    placeId: candidate.placeId ?? '',
    latitude: typeof candidate.latitude === 'number' ? candidate.latitude : null,
    longitude: typeof candidate.longitude === 'number' ? candidate.longitude : null,
    preferredLocations: candidate.preferredLocations ?? [],
    preferredRoles: candidate.preferredRoles ?? [],
    preferredCategories: candidate.preferredCategories ?? [],
    preferredJobTypes: candidate.preferredJobTypes ?? [],
    preferredWorkModes: candidate.preferredWorkModes ?? [],
    preferredWorkingDays: candidate.preferredWorkingDays ?? [],
    preferredShifts: candidate.preferredShifts ?? [],
    currentJobTitle: candidate.currentJobTitle ?? '',
    currentCompany: candidate.currentCompany ?? '',
    totalExperience: candidate.totalExperience ?? 0,
    currentSalary: candidate.currentSalary ?? null,
    expectedSalary: candidate.expectedSalary ?? null,
    noticePeriod: candidate.noticePeriod ?? 0,
    availableFrom: candidate.availableFrom ?? null,
    openToWork: candidate.openToWork !== false,
    employmentStatus: candidate.employmentStatus ?? 'looking',
    /** Sheet 149 — true when no work history and 0 years experience. */
    isFresher:
      (candidate.workExperience?.length ?? 0) === 0 &&
      (candidate.totalExperience ?? 0) === 0,
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
    verificationStatus,
    profileVisibility: candidate.profileVisibility ?? 'public',
    allowEmployerContact: candidate.allowEmployerContact !== false,
    resumeVisibleToEmployers: candidate.resumeVisibleToEmployers !== false,
    profileCompletion: candidate.profileCompletion ?? 0,
  };
}

function ageFromDob(dob: Date | null | undefined): number | null {
  if (!dob) return null;
  const birth = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 && age < 120 ? age : null;
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

  const phoneVerified = Boolean(user.phoneVerified);
  const verificationStatus = profile.verificationStatus ?? 'unverified';
  const verifiedBadge = verificationStatus === 'verified' || phoneVerified;

  return {
    user: mapSafeUserProfile(user),
    /** Alias kept for B7/B14 consumers. */
    candidate: profile,
    profile,
    trust: {
      verifiedBadge,
      verificationStatus,
      phoneVerified,
      emailVerified: Boolean(user.emailVerified),
    },
    completion: {
      percentage: details.percentage,
      completedSections: details.completedSections,
      missingSections: details.missingSections,
      missingFields: details.missingFields,
    },
  };
}
