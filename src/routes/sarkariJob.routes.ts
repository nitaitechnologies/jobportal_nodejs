import { Router } from 'express';
import { sarkariJobController } from '../controllers/sarkariJob.controller';
import {
  validateSarkariListQuery,
  validateSarkariSlugParam,
} from '../middlewares/sarkariJobValidate.middleware';

/** Public Sarkari Naukri browse/detail + sync trigger. */
const sarkariJobRouter = Router();

sarkariJobRouter.get('/', validateSarkariListQuery, (req, res, next) => {
  void sarkariJobController.list(req, res, next);
});

sarkariJobRouter.post('/sync', (req, res, next) => {
  void sarkariJobController.sync(req, res, next);
});

sarkariJobRouter.get('/:slug', validateSarkariSlugParam, (req, res, next) => {
  void sarkariJobController.getBySlug(req, res, next);
});

export default sarkariJobRouter;
