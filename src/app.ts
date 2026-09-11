import cors from 'cors';
import express, { Application } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { HTTP_STATUS } from './constants';
import { createDocsRouter } from './docs';
import { errorHandler } from './middlewares/error.middleware';
import { notFoundHandler } from './middlewares/notFound.middleware';
import { AppError } from './utils/AppError';
import v1Router from './routes';
import './types/express';

/**
 * Allowed CORS origins from environment (CLIENT_URL, ADMIN_CLIENT_URL, CORS_ORIGINS).
 * In development also allows localhost/127.0.0.1 on ports 3000 and 5173.
 * Never uses wildcard `*` in production (enforced in env.ts).
 */
function getAllowedOrigins(): string[] {
  return [...env.corsOrigins];
}

export function createApp(): Application {
  const app = express();

  if (env.trustProxy > 0) {
    app.set('trust proxy', env.trustProxy);
  }

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        const allowed = getAllowedOrigins();

        if (!origin || allowed.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(
          new AppError('CORS origin not allowed', HTTP_STATUS.FORBIDDEN, [
            { path: 'origin', message: 'Origin is not in the allowlist' },
          ]),
        );
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 100 }));

  // OpenAPI / Swagger UI — outside /api/v1 (not behind maintenanceGate).
  app.use('/api/docs', createDocsRouter());

  app.use(env.apiPrefix, v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
