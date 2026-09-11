import { Router } from 'express';
import { categoryController } from '../controllers/category.controller';
import { validatePublicCategoryQuery } from '../middlewares/categoryValidate.middleware';

const categoryRouter = Router();

categoryRouter.get('/', validatePublicCategoryQuery, (req, res, next) => {
  void categoryController.listPublic(req, res, next);
});

categoryRouter.get('/:slug/subcategories', (req, res, next) => {
  void categoryController.getSubcategories(req, res, next);
});

categoryRouter.get('/:slug', (req, res, next) => {
  void categoryController.getPublicBySlug(req, res, next);
});

export default categoryRouter;
