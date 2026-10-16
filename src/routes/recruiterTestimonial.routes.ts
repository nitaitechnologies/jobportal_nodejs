import { Router } from 'express';
import { publicContentController } from '../controllers/publicContent.controller';

const router = Router();

router.get('/', (req, res, next) => {
  void publicContentController.listRecruiterTestimonials(req, res, next);
});

export default router;
