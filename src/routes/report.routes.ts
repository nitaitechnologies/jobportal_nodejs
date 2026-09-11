import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { requireActiveAccount } from '../middlewares/accountStatus.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  validateReportCreate,
  validateReportIdParam,
  validateUserReportQuery,
} from '../middlewares/reportValidate.middleware';

/**
 * Authenticated user safety reports (candidate + employer).
 * No public unrestricted report list.
 */
const reportRouter = Router();

reportRouter.use(authenticate, requireRole('candidate', 'employer'), requireActiveAccount);

reportRouter.post('/', validateReportCreate, (req, res, next) => {
  void reportController.create(req, res, next);
});

reportRouter.get('/my', validateUserReportQuery, (req, res, next) => {
  void reportController.listMine(req, res, next);
});

reportRouter.get('/my/:id', validateReportIdParam, (req, res, next) => {
  void reportController.getMineById(req, res, next);
});

export default reportRouter;
