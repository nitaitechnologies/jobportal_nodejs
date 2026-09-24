import { Router } from 'express';
import { publicContentController } from '../controllers/publicContent.controller';

/** Public homepage banners (sheet 419). */
const bannerPublicRouter = Router();

bannerPublicRouter.get('/', (req, res, next) => {
  void publicContentController.listBanners(req, res, next);
});

export default bannerPublicRouter;
