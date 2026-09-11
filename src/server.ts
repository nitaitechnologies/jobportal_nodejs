import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';
import { ensureDefaultSettings } from './services/settings.service';
import type { Server } from 'http';

let httpServer: Server | null = null;
let shuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`[workindia-api] Received ${signal}; shutting down…`);

  const forceTimer = setTimeout(() => {
    console.error('[workindia-api] Forced exit after shutdown timeout');
    process.exit(1);
  }, 10_000);
  forceTimer.unref();

  try {
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer!.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
    await disconnectDatabase();
    console.log('[workindia-api] Shutdown complete');
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error('[workindia-api] Shutdown error:', message);
    process.exit(1);
  }
}

async function startServer(): Promise<void> {
  await connectDatabase();

  try {
    const { created } = await ensureDefaultSettings();
    if (created > 0) {
      console.log(`[workindia-api] Seeded ${created} default platform setting(s)`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error('[workindia-api] ensureDefaultSettings failed:', message);
  }

  const app = createApp();
  httpServer = app.listen(env.port);

  httpServer.on('listening', () => {
    console.log(
      `[workindia-api] Server running in ${env.nodeEnv} mode on port ${env.port}`,
    );
    console.log(
      `[workindia-api] Health: http://localhost:${env.port}${env.apiPrefix}/health`,
    );
    if (env.enableApiDocs) {
      console.log(
        `[workindia-api] API docs: http://localhost:${env.port}/api/docs`,
      );
    }
  });

  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `[workindia-api] Port ${env.port} is already in use. Set a free PORT in .env.`,
      );
    } else {
      console.error('[workindia-api] Server error:', error.message);
    }
    process.exit(1);
  });

  process.on('SIGTERM', () => {
    void gracefulShutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void gracefulShutdown('SIGINT');
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[workindia-api] Unhandled Rejection:', reason);
    void gracefulShutdown('unhandledRejection');
  });

  process.on('uncaughtException', (error) => {
    console.error('[workindia-api] Uncaught Exception:', error);
    void gracefulShutdown('uncaughtException');
  });
}

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  console.error('[workindia-api] Unable to start server:', message);
  process.exit(1);
});
