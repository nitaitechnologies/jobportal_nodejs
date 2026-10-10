import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';
import { ensureDefaultSettings } from './services/settings.service';
import { chatRealtime } from './services/chatRealtime.service';
import type { Server } from 'http';

let httpServer: Server | null = null;
let shuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`[${env.serviceName}] Received ${signal}; shutting down…`);

  const forceTimer = setTimeout(() => {
    console.error(`[${env.serviceName}] Forced exit after shutdown timeout`);
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
    console.log(`[${env.serviceName}] Shutdown complete`);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`[${env.serviceName}] Shutdown error:`, message);
    process.exit(1);
  }
}

async function startServer(): Promise<void> {
  await connectDatabase();

  try {
    const { created } = await ensureDefaultSettings();
    if (created > 0) {
      console.log(`[${env.serviceName}] Seeded ${created} default platform setting(s)`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`[${env.serviceName}] ensureDefaultSettings failed:`, message);
  }

  const app = createApp();
  // Render injects PORT. Never hard-code the production port. Bind all interfaces.
  const PORT = process.env.PORT || 5000;
  const HOST = '0.0.0.0';
  httpServer = app.listen(Number(PORT), HOST);

  // Realtime chat (Socket.IO) — shares the same HTTP server.
  chatRealtime.attach(httpServer);

  httpServer.on('listening', () => {
    console.log(
      `[${env.serviceName}] Server running in ${env.nodeEnv} mode on ${HOST}:${PORT}`,
    );
    console.log(
      `[${env.serviceName}] Health: ${env.apiPrefix}/health`,
    );
    if (env.enableApiDocs) {
      console.log(`[${env.serviceName}] API docs: /api/docs`);
    }
  });

  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `[${env.serviceName}] Port ${PORT} is already in use. Set a free PORT in .env.`,
      );
    } else {
      console.error(`[${env.serviceName}] Server error:`, error.message);
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
    console.error(`[${env.serviceName}] Unhandled Rejection:`, reason);
    void gracefulShutdown('unhandledRejection');
  });

  process.on('uncaughtException', (error) => {
    console.error(`[${env.serviceName}] Uncaught Exception:`, error);
    void gracefulShutdown('uncaughtException');
  });
}

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  console.error(`[${env.serviceName}] Unable to start server:`, message);
  process.exit(1);
});
