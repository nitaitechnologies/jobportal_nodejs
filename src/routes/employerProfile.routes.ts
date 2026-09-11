import { Router } from 'express';
import { companyController } from '../controllers/company.controller';
import { employerProfileController } from '../controllers/employerProfile.controller';
import { mediaController } from '../controllers/media.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireEmployer } from '../middlewares/employerAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { uploadSingle } from '../middlewares/upload.middleware';
import {
  validateCompanyProfileUpdate,
  validateEmployerProfileUpdate,
} from '../middlewares/employerCompanyValidate.middleware';

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

employerProfileRouter.patch('/company', validateCompanyProfileUpdate, (req, res, next) => {
  void companyController.updateOwnedCompany(req, res, next);
});

employerProfileRouter.post('/company/logo', uploadSingle('file'), (req, res, next) => {
  void mediaController.uploadCompanyLogo(req, res, next);
});

employerProfileRouter.delete('/company/logo', (req, res, next) => {
  void mediaController.deleteCompanyLogo(req, res, next);
});

employerProfileRouter.post('/company/cover-image', uploadSingle('file'), (req, res, next) => {
  void mediaController.uploadCompanyCover(req, res, next);
});

employerProfileRouter.delete('/company/cover-image', (req, res, next) => {
  void mediaController.deleteCompanyCover(req, res, next);
});

export default employerProfileRouter;
