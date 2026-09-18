import { Candidate, type ICandidate } from '../models/Candidate';
import { placesService } from './places.service';
import { User } from '../models/User';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import {
  deriveTotalExperienceYears,
  getCandidateProfileCompletionDetails,
} from '../utils/candidateProfileCompletion';
import {
  mapCandidateProfileResponse,
  mapResumeMetadata,
} from '../utils/candidateProfileMapper';
import type {
  CandidateProfileUpdateInput,
  CertificationCreateInput,
  CertificationUpdateInput,
  EducationCreateInput,
  EducationUpdateInput,
  ExperienceCreateInput,
  ExperienceUpdateInput,
  SkillCreateInput,
} from '../validators/candidateProfile.validator';

async function loadOwnedProfile(userId: string) {
  const [user, candidate] = await Promise.all([
    User.findById(userId).select('name email phone role avatar status deletedAt'),
    Candidate.findOne({ userId }),
  ]);

  if (!user || user.role !== 'candidate' || user.deletedAt) {
    throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
  }

  if (user.status !== 'active') {
    throw new AppError('Candidate access denied', HTTP_STATUS.FORBIDDEN);
  }

  if (!candidate) {
    throw new AppError('Candidate profile not found', HTTP_STATUS.NOT_FOUND);
  }

  return { user, candidate };
}

function applyCompletion(
  user: { name?: string | null; phone?: string | null; avatar?: string | null },
  candidate: ICandidate & { profileCompletion?: number | null },
) {
  const details = getCandidateProfileCompletionDetails(
    { name: user.name, phone: user.phone, avatar: user.avatar },
    candidate,
  );
  candidate.profileCompletion = details.percentage;
  return details;
}

function findSubdocById<T extends { _id?: { toString(): string } }>(
  items: T[],
  id: string,
): T | undefined {
  return items.find((item) => item._id?.toString() === id);
}

export class CandidateProfileService {
  async getOwnProfile(userId: string) {
    const { user, candidate } = await loadOwnedProfile(userId);
    const previous = candidate.profileCompletion ?? 0;
    const details = applyCompletion(user, candidate);
    if (previous !== details.percentage) {
      await candidate.save();
    }
    return mapCandidateProfileResponse(user, candidate, details);
  }

  async getCompletion(userId: string) {
    const { user, candidate } = await loadOwnedProfile(userId);
    const previous = candidate.profileCompletion ?? 0;
    const details = applyCompletion(user, candidate);
    if (previous !== details.percentage) {
      await candidate.save();
    }
    return {
      percentage: details.percentage,
      completedSections: details.completedSections,
      missingSections: details.missingSections,
      missingFields: details.missingFields,
      sections: details.sections,
    };
  }

  async updateOwnProfile(userId: string, input: CandidateProfileUpdateInput) {
    const { user, candidate } = await loadOwnedProfile(userId);

    if (input.phone && input.phone !== user.phone) {
      const phoneOwner = await User.findOne({
        phone: input.phone,
        _id: { $ne: user._id },
      }).select('_id');

      if (phoneOwner) {
        throw new AppError('An account with this phone already exists', HTTP_STATUS.CONFLICT);
      }
    }

    if (input.name !== undefined) {
      user.name = input.name;
    }
    if (input.phone !== undefined) {
      user.phone = input.phone;
    }
    if (input.avatar !== undefined) {
      user.avatar = input.avatar;
    }

    if (input.locationPlaceId) {
      const place = await placesService.resolve(input.locationPlaceId);
      candidate.currentLocation = place.address;
      candidate.placeId = place.placeId;
      candidate.latitude = place.latitude;
      candidate.longitude = place.longitude;
    }

    const candidateFields: Array<keyof CandidateProfileUpdateInput> = [
      'headline',
      'bio',
      'profilePhoto',
      'dateOfBirth',
      'gender',
      'currentLocation',
      'preferredLocations',
      'currentJobTitle',
      'currentCompany',
      'totalExperience',
      'expectedSalary',
      'noticePeriod',
      'employmentStatus',
      'skills',
      'education',
      'workExperience',
      'certifications',
      'languages',
      'portfolio',
      'socialLinks',
      'profileVisibility',
      'resume',
    ];

    for (const field of candidateFields) {
      if (input[field] === undefined) {
        continue;
      }

      if (field === 'currentLocation') {
        if (input.locationPlaceId) {
          continue;
        }
        candidate.currentLocation = input.currentLocation ?? '';
        candidate.placeId = '';
        candidate.set('latitude', undefined);
        candidate.set('longitude', undefined);
        continue;
      }

      if (field === 'workExperience' && Array.isArray(input.workExperience)) {
        candidate.workExperience = input.workExperience.map((item) => ({
          ...item,
          endDate: item.isCurrent ? undefined : item.endDate ?? undefined,
        })) as typeof candidate.workExperience;
        candidate.totalExperience = deriveTotalExperienceYears(candidate.workExperience);
        continue;
      }

      if (field === 'socialLinks' && input.socialLinks) {
        candidate.socialLinks = {
          linkedin: input.socialLinks.linkedin ?? candidate.socialLinks?.linkedin ?? '',
          twitter: input.socialLinks.twitter ?? candidate.socialLinks?.twitter ?? '',
          facebook: input.socialLinks.facebook ?? candidate.socialLinks?.facebook ?? '',
          instagram: input.socialLinks.instagram ?? candidate.socialLinks?.instagram ?? '',
          github: input.socialLinks.github ?? candidate.socialLinks?.github ?? '',
          website: input.socialLinks.website ?? candidate.socialLinks?.website ?? '',
        };
        continue;
      }

      if (field === 'expectedSalary') {
        candidate.expectedSalary = input.expectedSalary ?? undefined;
        continue;
      }

      if (field === 'dateOfBirth') {
        candidate.dateOfBirth = input.dateOfBirth ?? undefined;
        continue;
      }

      (candidate as unknown as Record<string, unknown>)[field] = input[field];
    }

    const details = applyCompletion(user, candidate);
    await Promise.all([user.save(), candidate.save()]);
    return mapCandidateProfileResponse(user, candidate, details);
  }

  async addSkill(userId: string, input: SkillCreateInput) {
    const { user, candidate } = await loadOwnedProfile(userId);
    const skill = input.skill.trim();
    const skills = [...(candidate.skills ?? [])];
    const exists = skills.some((item) => item.toLowerCase() === skill.toLowerCase());
    if (!exists) {
      if (skills.length >= 50) {
        throw new AppError('Maximum of 50 skills allowed', HTTP_STATUS.BAD_REQUEST);
      }
      skills.push(skill);
      candidate.skills = skills;
    }
    const details = applyCompletion(user, candidate);
    await candidate.save();
    return {
      skills: candidate.skills,
      completion: {
        percentage: details.percentage,
        completedSections: details.completedSections,
        missingSections: details.missingSections,
      },
    };
  }

  async removeSkill(userId: string, skillParam: string) {
    const { user, candidate } = await loadOwnedProfile(userId);
    const key = decodeURIComponent(skillParam).trim().toLowerCase();
    const before = candidate.skills?.length ?? 0;
    candidate.skills = (candidate.skills ?? []).filter((item) => item.toLowerCase() !== key);
    if ((candidate.skills?.length ?? 0) === before) {
      throw new AppError('Skill not found', HTTP_STATUS.NOT_FOUND);
    }
    const details = applyCompletion(user, candidate);
    await candidate.save();
    return {
      skills: candidate.skills,
      completion: { percentage: details.percentage },
    };
  }

  async addEducation(userId: string, input: EducationCreateInput) {
    const { user, candidate } = await loadOwnedProfile(userId);
    if ((candidate.education?.length ?? 0) >= 20) {
      throw new AppError('Maximum of 20 education entries allowed', HTTP_STATUS.BAD_REQUEST);
    }
    candidate.education.push(input as (typeof candidate.education)[number]);
    const details = applyCompletion(user, candidate);
    await candidate.save();
    return {
      education: candidate.education,
      completion: { percentage: details.percentage },
    };
  }

  async updateEducation(userId: string, educationId: string, input: EducationUpdateInput) {
    const { user, candidate } = await loadOwnedProfile(userId);
    const entry = findSubdocById(candidate.education, educationId);
    if (!entry) {
      throw new AppError('Education entry not found', HTTP_STATUS.NOT_FOUND);
    }

    if (input.degree !== undefined) entry.degree = input.degree;
    if (input.fieldOfStudy !== undefined) entry.fieldOfStudy = input.fieldOfStudy;
    if (input.institution !== undefined) entry.institution = input.institution;
    if (input.startYear !== undefined) entry.startYear = input.startYear;
    if (input.endYear !== undefined) entry.endYear = input.endYear;
    if (input.grade !== undefined) entry.grade = input.grade;
    if (input.description !== undefined) entry.description = input.description;

    const start = entry.startYear;
    const end = entry.endYear;
    if (start !== undefined && end !== undefined && end < start) {
      throw new AppError('endYear must be on or after startYear', HTTP_STATUS.BAD_REQUEST);
    }

    const details = applyCompletion(user, candidate);
    await candidate.save();
    return {
      education: candidate.education,
      completion: { percentage: details.percentage },
    };
  }

  async removeEducation(userId: string, educationId: string) {
    const { user, candidate } = await loadOwnedProfile(userId);
    const before = candidate.education.length;
    candidate.education = candidate.education.filter(
      (item) => item._id?.toString() !== educationId,
    ) as typeof candidate.education;
    if (candidate.education.length === before) {
      throw new AppError('Education entry not found', HTTP_STATUS.NOT_FOUND);
    }
    const details = applyCompletion(user, candidate);
    await candidate.save();
    return {
      education: candidate.education,
      completion: { percentage: details.percentage },
    };
  }

  async addExperience(userId: string, input: ExperienceCreateInput) {
    const { user, candidate } = await loadOwnedProfile(userId);
    if ((candidate.workExperience?.length ?? 0) >= 30) {
      throw new AppError('Maximum of 30 work experience entries allowed', HTTP_STATUS.BAD_REQUEST);
    }
    candidate.workExperience.push({
      ...input,
      endDate: input.isCurrent ? undefined : input.endDate ?? undefined,
    } as (typeof candidate.workExperience)[number]);
    candidate.totalExperience = deriveTotalExperienceYears(candidate.workExperience);
    const details = applyCompletion(user, candidate);
    await candidate.save();
    return {
      workExperience: candidate.workExperience,
      totalExperience: candidate.totalExperience,
      completion: { percentage: details.percentage },
    };
  }

  async updateExperience(userId: string, experienceId: string, input: ExperienceUpdateInput) {
    const { user, candidate } = await loadOwnedProfile(userId);
    const entry = findSubdocById(candidate.workExperience, experienceId);
    if (!entry) {
      throw new AppError('Work experience entry not found', HTTP_STATUS.NOT_FOUND);
    }

    if (input.jobTitle !== undefined) entry.jobTitle = input.jobTitle;
    if (input.company !== undefined) entry.company = input.company;
    if (input.location !== undefined) entry.location = input.location;
    if (input.startDate !== undefined) entry.startDate = input.startDate;
    if (input.isCurrent !== undefined) entry.isCurrent = input.isCurrent;
    if (input.description !== undefined) entry.description = input.description;
    if (input.endDate !== undefined) {
      entry.endDate = input.endDate ?? undefined;
    }
    if (entry.isCurrent) {
      entry.endDate = undefined;
    }
    if (entry.startDate && entry.endDate && entry.endDate < entry.startDate) {
      throw new AppError('endDate must be on or after startDate', HTTP_STATUS.BAD_REQUEST);
    }

    candidate.totalExperience = deriveTotalExperienceYears(candidate.workExperience);
    const details = applyCompletion(user, candidate);
    await candidate.save();
    return {
      workExperience: candidate.workExperience,
      totalExperience: candidate.totalExperience,
      completion: { percentage: details.percentage },
    };
  }

  async removeExperience(userId: string, experienceId: string) {
    const { user, candidate } = await loadOwnedProfile(userId);
    const before = candidate.workExperience.length;
    candidate.workExperience = candidate.workExperience.filter(
      (item) => item._id?.toString() !== experienceId,
    ) as typeof candidate.workExperience;
    if (candidate.workExperience.length === before) {
      throw new AppError('Work experience entry not found', HTTP_STATUS.NOT_FOUND);
    }
    candidate.totalExperience = deriveTotalExperienceYears(candidate.workExperience);
    const details = applyCompletion(user, candidate);
    await candidate.save();
    return {
      workExperience: candidate.workExperience,
      totalExperience: candidate.totalExperience,
      completion: { percentage: details.percentage },
    };
  }

  async addCertification(userId: string, input: CertificationCreateInput) {
    const { user, candidate } = await loadOwnedProfile(userId);
    if ((candidate.certifications?.length ?? 0) >= 30) {
      throw new AppError('Maximum of 30 certifications allowed', HTTP_STATUS.BAD_REQUEST);
    }
    candidate.certifications.push(input as (typeof candidate.certifications)[number]);
    const details = applyCompletion(user, candidate);
    await candidate.save();
    return {
      certifications: candidate.certifications,
      completion: { percentage: details.percentage },
    };
  }

  async updateCertification(
    userId: string,
    certificationId: string,
    input: CertificationUpdateInput,
  ) {
    const { user, candidate } = await loadOwnedProfile(userId);
    const entry = findSubdocById(candidate.certifications, certificationId);
    if (!entry) {
      throw new AppError('Certification not found', HTTP_STATUS.NOT_FOUND);
    }

    if (input.name !== undefined) entry.name = input.name;
    if (input.issuer !== undefined) entry.issuer = input.issuer;
    if (input.issueDate !== undefined) entry.issueDate = input.issueDate;
    if (input.expiryDate !== undefined) entry.expiryDate = input.expiryDate;
    if (input.credentialId !== undefined) entry.credentialId = input.credentialId;
    if (input.credentialUrl !== undefined) entry.credentialUrl = input.credentialUrl;

    if (entry.issueDate && entry.expiryDate && entry.expiryDate < entry.issueDate) {
      throw new AppError('expiryDate must be on or after issueDate', HTTP_STATUS.BAD_REQUEST);
    }

    const details = applyCompletion(user, candidate);
    await candidate.save();
    return {
      certifications: candidate.certifications,
      completion: { percentage: details.percentage },
    };
  }

  async removeCertification(userId: string, certificationId: string) {
    const { user, candidate } = await loadOwnedProfile(userId);
    const before = candidate.certifications.length;
    candidate.certifications = candidate.certifications.filter(
      (item) => item._id?.toString() !== certificationId,
    ) as typeof candidate.certifications;
    if (candidate.certifications.length === before) {
      throw new AppError('Certification not found', HTTP_STATUS.NOT_FOUND);
    }
    const details = applyCompletion(user, candidate);
    await candidate.save();
    return {
      certifications: candidate.certifications,
      completion: { percentage: details.percentage },
    };
  }

  async getResume(userId: string) {
    const { candidate } = await loadOwnedProfile(userId);
    return mapResumeMetadata(candidate);
  }

  async deleteResume(userId: string) {
    const { user, candidate } = await loadOwnedProfile(userId);
    candidate.resume = '';
    const details = applyCompletion(user, candidate);
    await candidate.save();
    return {
      resume: mapResumeMetadata(candidate),
      completion: {
        percentage: details.percentage,
        completedSections: details.completedSections,
        missingSections: details.missingSections,
      },
    };
  }
}

export const candidateProfileService = new CandidateProfileService();
