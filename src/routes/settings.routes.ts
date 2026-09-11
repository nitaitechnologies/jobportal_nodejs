import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller';

const settingsPublicRouter = Router();

settingsPublicRouter.get('/public', (req, res, next) => {
  void settingsController.getPublic(req, res, next);
});

export default settingsPublicRouter;
