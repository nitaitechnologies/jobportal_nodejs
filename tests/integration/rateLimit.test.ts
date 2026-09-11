import express from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import { HTTP_STATUS } from '../../src/constants';
import { sendError } from '../../src/utils/apiResponse';

describe('Auth rate limiting behavior', () => {
  it('returns 429 after exceeding configured max attempts', async () => {
    const app = express();
    app.use(express.json());
    const limiter = rateLimit({
      windowMs: 60_000,
      max: 3,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) => {
        sendError(
          res,
          'Too many authentication attempts. Please try again later.',
          HTTP_STATUS.TOO_MANY_REQUESTS,
          [{ path: 'rateLimit', message: 'Rate limit exceeded' }],
        );
      },
      validate: { xForwardedForHeader: false },
    });
    app.post('/login', limiter, (_req, res) => {
      res.status(401).json({ success: false, message: 'Invalid', errors: [] });
    });

    await request(app).post('/login').send({});
    await request(app).post('/login').send({});
    await request(app).post('/login').send({});
    const limited = await request(app).post('/login').send({});
    expect(limited.status).toBe(429);
    expect(limited.body.success).toBe(false);
  });
});
