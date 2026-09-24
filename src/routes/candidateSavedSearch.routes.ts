import { Router } from 'express';
import { savedSearchController } from '../controllers/savedSearch.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCandidate } from '../middlewares/candidateAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  validateAlertSettingsUpdate,
  validateSavedSearchCreate,
  validateSavedSearchIdParam,
  validateSavedSearchQuery,
  validateSavedSearchUpdate,
} from '../middlewares/savedSearchValidate.middleware';

const candidateSavedSearchRouter = Router();

candidateSavedSearchRouter.use(authenticate, requireRole('candidate'), requireCandidate);

candidateSavedSearchRouter.get('/alert-settings', (req, res, next) => {
  void savedSearchController.getAlertSettings(req, res, next);
});

candidateSavedSearchRouter.patch(
  '/alert-settings',
  validateAlertSettingsUpdate,
  (req, res, next) => {
    void savedSearchController.updateAlertSettings(req, res, next);
  },
);

candidateSavedSearchRouter.get('/', validateSavedSearchQuery, (req, res, next) => {
  void savedSearchController.list(req, res, next);
});

candidateSavedSearchRouter.post('/', validateSavedSearchCreate, (req, res, next) => {
  void savedSearchController.create(req, res, next);
});

candidateSavedSearchRouter.get('/:id', validateSavedSearchIdParam, (req, res, next) => {
  void savedSearchController.getById(req, res, next);
});

candidateSavedSearchRouter.patch(
  '/:id',
  validateSavedSearchIdParam,
  validateSavedSearchUpdate,
  (req, res, next) => {
    void savedSearchController.update(req, res, next);
  },
);

candidateSavedSearchRouter.delete('/:id', validateSavedSearchIdParam, (req, res, next) => {
  void savedSearchController.remove(req, res, next);
});

export default candidateSavedSearchRouter;
