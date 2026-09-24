import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', requirePermission(PERMISSIONS.SUPPORT_TICKETS_READ), (req, res, next) => {
  void chatController.adminList(req, res, next);
});

router.get('/:id/messages', requirePermission(PERMISSIONS.SUPPORT_TICKETS_READ), (req, res, next) => {
  void chatController.adminListMessages(req, res, next);
});

export default router;
