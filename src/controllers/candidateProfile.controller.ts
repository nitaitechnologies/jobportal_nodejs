import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { candidateProfileService } from '../services/candidateProfile.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
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
import '../types/express';

function requireAuthUserId(req: Request): string {
  if (!req.auth) {
    throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
  }
  return req.auth.userId;
}

export class CandidateProfileController {
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await candidateProfileService.getOwnProfile(requireAuthUserId(req));
      sendSuccess(res, data, 'Candidate profile fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await candidateProfileService.updateOwnProfile(
        requireAuthUserId(req),
        req.body as CandidateProfileUpdateInput,
      );
      sendSuccess(res, data, 'Candidate profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCompletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await candidateProfileService.getCompletion(requireAuthUserId(req));
      sendSuccess(res, data, 'Profile completion fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async addSkill(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await candidateProfileService.addSkill(
        requireAuthUserId(req),
        req.body as SkillCreateInput,
      );
      sendSuccess(res, data, 'Skill added successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeSkill(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const skill = typeof req.params.skill === 'string' ? req.params.skill : '';
      const data = await candidateProfileService.removeSkill(requireAuthUserId(req), skill);
      sendSuccess(res, data, 'Skill removed successfully');
    } catch (error) {
      next(error);
    }
  }

  async addEducation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await candidateProfileService.addEducation(
        requireAuthUserId(req),
        req.body as EducationCreateInput,
      );
      sendSuccess(res, data, 'Education added successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async updateEducation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const educationId =
        typeof req.params.educationId === 'string' ? req.params.educationId : '';
      const data = await candidateProfileService.updateEducation(
        requireAuthUserId(req),
        educationId,
        req.body as EducationUpdateInput,
      );
      sendSuccess(res, data, 'Education updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeEducation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const educationId =
        typeof req.params.educationId === 'string' ? req.params.educationId : '';
      const data = await candidateProfileService.removeEducation(
        requireAuthUserId(req),
        educationId,
      );
      sendSuccess(res, data, 'Education removed successfully');
    } catch (error) {
      next(error);
    }
  }

  async addExperience(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await candidateProfileService.addExperience(
        requireAuthUserId(req),
        req.body as ExperienceCreateInput,
      );
      sendSuccess(res, data, 'Work experience added successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async updateExperience(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const experienceId =
        typeof req.params.experienceId === 'string' ? req.params.experienceId : '';
      const data = await candidateProfileService.updateExperience(
        requireAuthUserId(req),
        experienceId,
        req.body as ExperienceUpdateInput,
      );
      sendSuccess(res, data, 'Work experience updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeExperience(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const experienceId =
        typeof req.params.experienceId === 'string' ? req.params.experienceId : '';
      const data = await candidateProfileService.removeExperience(
        requireAuthUserId(req),
        experienceId,
      );
      sendSuccess(res, data, 'Work experience removed successfully');
    } catch (error) {
      next(error);
    }
  }

  async addCertification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await candidateProfileService.addCertification(
        requireAuthUserId(req),
        req.body as CertificationCreateInput,
      );
      sendSuccess(res, data, 'Certification added successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async updateCertification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const certificationId =
        typeof req.params.certificationId === 'string' ? req.params.certificationId : '';
      const data = await candidateProfileService.updateCertification(
        requireAuthUserId(req),
        certificationId,
        req.body as CertificationUpdateInput,
      );
      sendSuccess(res, data, 'Certification updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeCertification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const certificationId =
        typeof req.params.certificationId === 'string' ? req.params.certificationId : '';
      const data = await candidateProfileService.removeCertification(
        requireAuthUserId(req),
        certificationId,
      );
      sendSuccess(res, data, 'Certification removed successfully');
    } catch (error) {
      next(error);
    }
  }

  async getResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await candidateProfileService.getResume(requireAuthUserId(req));
      sendSuccess(res, data, 'Resume metadata fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await candidateProfileService.deleteResume(requireAuthUserId(req));
      sendSuccess(res, data, 'Resume metadata removed successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const candidateProfileController = new CandidateProfileController();
