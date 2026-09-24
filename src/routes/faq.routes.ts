import { Router } from 'express';
import { publicContentController } from '../controllers/publicContent.controller';

/** Public FAQs (sheet 422). */
const faqPublicRouter = Router();

faqPublicRouter.get('/', (req, res, next) => {
  void publicContentController.listFaqs(req, res, next);
});

export default faqPublicRouter;
