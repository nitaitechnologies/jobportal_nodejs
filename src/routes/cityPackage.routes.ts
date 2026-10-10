import { Router } from 'express';
import { cityPackageController } from '../controllers/cityPackage.controller';
import { PERMISSIONS } from '../constants/permissions';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import { requireEmployer } from '../middlewares/employerAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validateObjectIdParam } from '../middlewares/objectIdParam.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import {
  cityPackageCreateSchema,
  cityPackageUpdateSchema,
  customProposalCreateSchema,
} from '../validators/cityPackage.validator';

const adminCityPackageRouter = Router();

adminCityPackageRouter.use(authenticate, requireAdmin);

adminCityPackageRouter.get('/', requirePermission(PERMISSIONS.PLANS_READ), (req, res, next) => {
  void cityPackageController.adminList(req, res, next);
});

adminCityPackageRouter.post(
  '/',
  requirePermission(PERMISSIONS.PLANS_CREATE),
  validateBody(cityPackageCreateSchema),
  (req, res, next) => {
    void cityPackageController.adminCreate(req, res, next);
  },
);

adminCityPackageRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.PLANS_UPDATE),
  validateObjectIdParam('id'),
  validateBody(cityPackageUpdateSchema),
  (req, res, next) => {
    void cityPackageController.adminUpdate(req, res, next);
  },
);

adminCityPackageRouter.get(
  '/companies',
  requirePermission(PERMISSIONS.COMPANIES_READ),
  (req, res, next) => {
    void cityPackageController.searchCompanies(req, res, next);
  },
);

adminCityPackageRouter.get(
  '/proposals',
  requirePermission(PERMISSIONS.PLANS_READ),
  (req, res, next) => {
    void cityPackageController.listProposals(req, res, next);
  },
);

adminCityPackageRouter.post(
  '/proposals',
  requirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE),
  validateBody(customProposalCreateSchema),
  (req, res, next) => {
    void cityPackageController.createProposal(req, res, next);
  },
);

const employerCityPackageRouter = Router();

employerCityPackageRouter.use(authenticate, requireRole('employer'), requireEmployer);
employerCityPackageRouter.get('/', (req, res, next) => {
  void cityPackageController.employerOffer(req, res, next);
});

export { adminCityPackageRouter, employerCityPackageRouter };
