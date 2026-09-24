import { Router } from 'express';
import { supportTicketController } from '../controllers/supportTicket.controller';
import { optionalAuthenticate } from '../middlewares/auth.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  validateSupportTicketCreate,
  validateSupportTicketQuery,
} from '../middlewares/supportTicketValidate.middleware';

/**
 * Public (optional auth) support tickets — raise ticket / technical issues (374, 377).
 */
const supportTicketRouter = Router();

supportTicketRouter.post(
  '/',
  optionalAuthenticate,
  validateSupportTicketCreate,
  (req, res, next) => {
    void supportTicketController.create(req, res, next);
  },
);

supportTicketRouter.get(
  '/my',
  authenticate,
  requireRole('candidate', 'employer'),
  validateSupportTicketQuery,
  (req, res, next) => {
    void supportTicketController.listMine(req, res, next);
  },
);

export default supportTicketRouter;
