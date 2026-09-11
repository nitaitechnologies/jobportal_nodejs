import { Router } from 'express';
import { healthController } from '../controllers/health.controller';

const healthRouter = Router();

healthRouter.get('/', (req, res, next) => {
  healthController.getHealth(req, res, next);
});

export default healthRouter;
