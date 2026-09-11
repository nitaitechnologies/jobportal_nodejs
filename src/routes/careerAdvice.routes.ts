import { Router } from 'express';
import { careerAdviceController } from '../controllers/careerAdvice.controller';
import {
  validateCareerArticleSlugParam,
  validatePublicCareerAdviceQuery,
} from '../middlewares/careerAdviceValidate.middleware';

/** Public career advice browse/detail. */
const careerAdviceRouter = Router();

careerAdviceRouter.get('/', validatePublicCareerAdviceQuery, (req, res, next) => {
  void careerAdviceController.listPublic(req, res, next);
});

careerAdviceRouter.get('/:slug', validateCareerArticleSlugParam, (req, res, next) => {
  void careerAdviceController.getPublicBySlug(req, res, next);
});

export default careerAdviceRouter;
