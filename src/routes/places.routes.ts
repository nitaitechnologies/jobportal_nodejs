import { Router } from 'express';
import { placesService } from '../services/places.service';
import { sendSuccess } from '../utils/apiResponse';

const placesRouter = Router();

placesRouter.get('/autocomplete', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const places = await placesService.autocomplete(q);
    sendSuccess(res, { places }, 'Places fetched successfully');
  } catch (error) {
    next(error);
  }
});

placesRouter.get('/details', async (req, res, next) => {
  try {
    const placeId = typeof req.query.placeId === 'string' ? req.query.placeId : '';
    const place = await placesService.resolve(placeId);
    sendSuccess(res, { place }, 'Place fetched successfully');
  } catch (error) {
    next(error);
  }
});

export default placesRouter;
