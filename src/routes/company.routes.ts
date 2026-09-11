import { Router } from 'express';
import { companyController } from '../controllers/company.controller';

/**
 * Public company routes.
 * Visibility: status=active and verificationStatus != rejected.
 */
const companyRouter = Router();

companyRouter.get('/:slug', (req, res, next) => {
  void companyController.getPublicBySlug(req, res, next);
});

export default companyRouter;
