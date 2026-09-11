import { Router } from 'express';
import { jobController } from '../controllers/job.controller';
import { validatePublicJobQuery } from '../middlewares/jobValidate.middleware';

const jobRouter = Router();

jobRouter.get('/', validatePublicJobQuery, (req, res, next) => {
  void jobController.listPublic(req, res, next);
});

jobRouter.get('/:slug', (req, res, next) => {
  void jobController.getPublicBySlug(req, res, next);
});

export default jobRouter;
