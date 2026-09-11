import { Router } from 'express';
import { locationController } from '../controllers/location.controller';
import { validatePublicLocationQuery } from '../middlewares/locationValidate.middleware';

const locationRouter = Router();

locationRouter.get('/', validatePublicLocationQuery, (req, res, next) => {
  void locationController.listPublic(req, res, next);
});

locationRouter.get('/:slug/children', (req, res, next) => {
  void locationController.getChildren(req, res, next);
});

locationRouter.get('/:slug', (req, res, next) => {
  void locationController.getPublicBySlug(req, res, next);
});

export default locationRouter;
