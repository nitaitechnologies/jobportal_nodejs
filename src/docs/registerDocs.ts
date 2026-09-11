import { Router, type Request, type Response, type NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { env } from '../config/env';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import { getOpenApiDocument } from './openapi';

/**
 * Mount at `/api/docs` (not under `/api/v1`).
 * Controlled by ENABLE_API_DOCS (default: on in development, off in production).
 */
export function createDocsRouter(): Router {
  const router = Router();

  router.use((_req: Request, _res: Response, next: NextFunction) => {
    if (!env.enableApiDocs) {
      next(new AppError('API documentation is disabled', HTTP_STATUS.NOT_FOUND));
      return;
    }
    next();
  });

  router.get('/openapi.json', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(getOpenApiDocument());
  });

  router.use(
    '/',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      swaggerOptions: {
        url: '/api/docs/openapi.json',
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'none',
        filter: true,
        tryItOutEnabled: true,
      },
      customSiteTitle: 'WorkIndia API Docs',
      customCss: '.swagger-ui .topbar { display: none }',
    }),
  );

  return router;
}
