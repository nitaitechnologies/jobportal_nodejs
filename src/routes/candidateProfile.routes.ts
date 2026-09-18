import { Router } from 'express';
import { candidateProfileController } from '../controllers/candidateProfile.controller';
import { mediaController } from '../controllers/media.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCandidate } from '../middlewares/candidateAuth.middleware';
import { requireVideoResumeEnabled } from '../middlewares/featureFlag.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { uploadSingle } from '../middlewares/upload.middleware';
import {
  validateCandidateProfileUpdate,
  validateCertificationCreate,
  validateCertificationUpdate,
  validateEducationCreate,
  validateEducationUpdate,
  validateExperienceCreate,
  validateExperienceUpdate,
  validateObjectIdParam,
  validateSkillCreate,
} from '../middlewares/candidateProfileValidate.middleware';

/**
 * Candidate profile routes (B7 + B15 + B23 media).
 * Ownership is always derived from the authenticated JWT identity.
 */
const candidateProfileRouter = Router();

candidateProfileRouter.use(authenticate, requireRole('candidate'), requireCandidate);

candidateProfileRouter.get('/', (req, res, next) => {
  void candidateProfileController.getProfile(req, res, next);
});

candidateProfileRouter.patch('/', validateCandidateProfileUpdate, (req, res, next) => {
  void candidateProfileController.updateProfile(req, res, next);
});

candidateProfileRouter.get('/completion', (req, res, next) => {
  void candidateProfileController.getCompletion(req, res, next);
});

candidateProfileRouter.post('/avatar', uploadSingle('file'), (req, res, next) => {
  void mediaController.uploadCandidateAvatar(req, res, next);
});

candidateProfileRouter.delete('/avatar', (req, res, next) => {
  void mediaController.deleteCandidateAvatar(req, res, next);
});

candidateProfileRouter.post('/resume', uploadSingle('file'), (req, res, next) => {
  void mediaController.uploadCandidateResume(req, res, next);
});

candidateProfileRouter.get('/resume', (req, res, next) => {
  void mediaController.getCandidateResume(req, res, next);
});

candidateProfileRouter.get('/resume/download', (req, res, next) => {
  void mediaController.downloadCandidateResume(req, res, next);
});

candidateProfileRouter.delete('/resume', (req, res, next) => {
  void mediaController.deleteCandidateResume(req, res, next);
});

candidateProfileRouter.post(
  '/video-resume',
  requireVideoResumeEnabled,
  uploadSingle('file'),
  (req, res, next) => {
    void mediaController.uploadCandidateVideoResume(req, res, next);
  },
);

candidateProfileRouter.get('/video-resume', requireVideoResumeEnabled, (req, res, next) => {
  void mediaController.getCandidateVideoResume(req, res, next);
});

candidateProfileRouter.get(
  '/video-resume/download',
  requireVideoResumeEnabled,
  (req, res, next) => {
    void mediaController.downloadCandidateVideoResume(req, res, next);
  },
);

candidateProfileRouter.delete('/video-resume', requireVideoResumeEnabled, (req, res, next) => {
  void mediaController.deleteCandidateVideoResume(req, res, next);
});

candidateProfileRouter.post('/skills', validateSkillCreate, (req, res, next) => {
  void candidateProfileController.addSkill(req, res, next);
});

candidateProfileRouter.delete('/skills/:skill', (req, res, next) => {
  void candidateProfileController.removeSkill(req, res, next);
});

candidateProfileRouter.post('/education', validateEducationCreate, (req, res, next) => {
  void candidateProfileController.addEducation(req, res, next);
});

candidateProfileRouter.patch(
  '/education/:educationId',
  validateObjectIdParam('educationId'),
  validateEducationUpdate,
  (req, res, next) => {
    void candidateProfileController.updateEducation(req, res, next);
  },
);

candidateProfileRouter.delete(
  '/education/:educationId',
  validateObjectIdParam('educationId'),
  (req, res, next) => {
    void candidateProfileController.removeEducation(req, res, next);
  },
);

candidateProfileRouter.post('/experience', validateExperienceCreate, (req, res, next) => {
  void candidateProfileController.addExperience(req, res, next);
});

candidateProfileRouter.patch(
  '/experience/:experienceId',
  validateObjectIdParam('experienceId'),
  validateExperienceUpdate,
  (req, res, next) => {
    void candidateProfileController.updateExperience(req, res, next);
  },
);

candidateProfileRouter.delete(
  '/experience/:experienceId',
  validateObjectIdParam('experienceId'),
  (req, res, next) => {
    void candidateProfileController.removeExperience(req, res, next);
  },
);

candidateProfileRouter.post(
  '/certifications',
  validateCertificationCreate,
  (req, res, next) => {
    void candidateProfileController.addCertification(req, res, next);
  },
);

candidateProfileRouter.patch(
  '/certifications/:certificationId',
  validateObjectIdParam('certificationId'),
  validateCertificationUpdate,
  (req, res, next) => {
    void candidateProfileController.updateCertification(req, res, next);
  },
);

candidateProfileRouter.delete(
  '/certifications/:certificationId',
  validateObjectIdParam('certificationId'),
  (req, res, next) => {
    void candidateProfileController.removeCertification(req, res, next);
  },
);

export default candidateProfileRouter;
