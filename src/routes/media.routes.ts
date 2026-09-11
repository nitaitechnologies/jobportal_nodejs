import { Router } from 'express';
import { mediaController } from '../controllers/media.controller';
import { validateAdminIdParam } from '../middlewares/adminManagementValidate.middleware';

/**
 * Public media streaming (logos, avatars, article images).
 * Private files (resumes) are never served here.
 */
const mediaPublicRouter = Router();

mediaPublicRouter.get('/public/:id', validateAdminIdParam, (req, res, next) => {
  void mediaController.streamPublic(req, res, next);
});

export default mediaPublicRouter;
