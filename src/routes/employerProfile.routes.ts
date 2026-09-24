import { Router } from 'express';
import { companyController } from '../controllers/company.controller';
import { companyVerificationController } from '../controllers/companyVerification.controller';
import { employerProfileController } from '../controllers/employerProfile.controller';
import { mediaController } from '../controllers/media.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireEmployer, requireEmployerPermission } from '../middlewares/employerAuth.middleware';
import { EMPLOYER_PERMISSIONS } from '../constants/employerPermissions';
import { requireRole } from '../middlewares/role.middleware';
import { uploadSingle } from '../middlewares/upload.middleware';
import {
  validateCompanyProfileUpdate,
  validateEmployerProfileUpdate,
} from '../middlewares/employerCompanyValidate.middleware';
import {
  validateCompanyDocumentSubmit,
  validateCompanyVerificationDetails,
} from '../middlewares/companyVerificationValidate.middleware';

/**
 * Employer-owned profile and company management.
 * Ownership is always derived from the authenticated JWT identity.
 */
const employerProfileRouter = Router();

employerProfileRouter.use(authenticate, requireRole('employer'), requireEmployer);

employerProfileRouter.get('/profile', (req, res, next) => {
  void employerProfileController.getProfile(req, res, next);
});

employerProfileRouter.patch('/profile', validateEmployerProfileUpdate, (req, res, next) => {
  void employerProfileController.updateProfile(req, res, next);
});

employerProfileRouter.get('/company', (req, res, next) => {
  void companyController.getOwnedCompany(req, res, next);
});

employerProfileRouter.patch('/company', requireEmployerPermission(EMPLOYER_PERMISSIONS.COMPANY_UPDATE), validateCompanyProfileUpdate, (req, res, next) => {
  void companyController.updateOwnedCompany(req, res, next);
});

employerProfileRouter.get('/company/verification', (req, res, next) => {
  void companyVerificationController.getStatus(req, res, next);
});

employerProfileRouter.patch(
  '/company/verification',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.COMPANY_UPDATE),
  validateCompanyVerificationDetails,
  (req, res, next) => {
    void companyVerificationController.updateDetails(req, res, next);
  },
);

employerProfileRouter.post(
  '/company/verification/documents',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.COMPANY_UPDATE),
  uploadSingle('file'),
  validateCompanyDocumentSubmit,
  (req, res, next) => {
    void companyVerificationController.uploadDocument(req, res, next);
  },
);

employerProfileRouter.post(
  '/company/logo',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.COMPANY_UPDATE),
  uploadSingle('file'),
  (req, res, next) => {
    void mediaController.uploadCompanyLogo(req, res, next);
  },
);

employerProfileRouter.delete(
  '/company/logo',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.COMPANY_UPDATE),
  (req, res, next) => {
    void mediaController.deleteCompanyLogo(req, res, next);
  },
);

employerProfileRouter.post(
  '/company/cover-image',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.COMPANY_UPDATE),
  uploadSingle('file'),
  (req, res, next) => {
    void mediaController.uploadCompanyCover(req, res, next);
  },
);

employerProfileRouter.delete(
  '/company/cover-image',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.COMPANY_UPDATE),
  (req, res, next) => {
    void mediaController.deleteCompanyCover(req, res, next);
  },
);

employerProfileRouter.post(
  '/company/gallery',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.COMPANY_UPDATE),
  uploadSingle('file'),
  (req, res, next) => {
    void mediaController.uploadCompanyGalleryItem(req, res, next);
  },
);

employerProfileRouter.delete(
  '/company/gallery/:index',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.COMPANY_UPDATE),
  (req, res, next) => {
    void mediaController.deleteCompanyGalleryItem(req, res, next);
  },
);

export default employerProfileRouter;
