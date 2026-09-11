import { Router } from 'express';
import { adminManagementController } from '../controllers/adminManagement.controller';
import { authenticate } from '../middlewares/auth.middleware';
import {
  requireAdmin,
  requireAdminRole,
  requirePermission,
} from '../middlewares/adminAuth.middleware';
import {
  validateAdminIdParam,
  validateAdminUserCreate,
  validateAdminUserListQuery,
  validateAdminUserRole,
  validateAdminUserStatus,
  validateAdminUserUpdate,
} from '../middlewares/adminManagementValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', requirePermission(PERMISSIONS.USERS_READ), validateAdminUserListQuery, (req, res, next) => {
  void adminManagementController.listAdminUsers(req, res, next);
});

router.post('/', requirePermission(PERMISSIONS.USERS_CREATE), validateAdminUserCreate, (req, res, next) => {
  void adminManagementController.createAdminUser(req, res, next);
});

router.get('/:id', requirePermission(PERMISSIONS.USERS_READ), validateAdminIdParam, (req, res, next) => {
  void adminManagementController.getAdminUser(req, res, next);
});

router.patch('/:id', requirePermission(PERMISSIONS.USERS_UPDATE), validateAdminIdParam, validateAdminUserUpdate, (req, res, next) => {
  void adminManagementController.updateAdminUser(req, res, next);
});

router.patch('/:id/status', requirePermission(PERMISSIONS.USERS_UPDATE), validateAdminIdParam, validateAdminUserStatus, (req, res, next) => {
  void adminManagementController.updateAdminUserStatus(req, res, next);
});

router.patch(
  '/:id/role',
  requireAdminRole('super_admin'),
  validateAdminIdParam,
  validateAdminUserRole,
  (req, res, next) => {
    void adminManagementController.updateAdminUserRole(req, res, next);
  },
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.USERS_DELETE),
  requireAdminRole('super_admin'),
  validateAdminIdParam,
  (req, res, next) => {
    void adminManagementController.deleteAdminUser(req, res, next);
  },
);

export default router;
