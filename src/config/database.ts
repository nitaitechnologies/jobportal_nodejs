import mongoose from 'mongoose';
import { env } from './env';

const MongooseConnectionStates = {
  disconnected: 0,
  connected: 1,
  connecting: 2,
  disconnecting: 3,
} as const;

let listenersRegistered = false;
let hasConnectedOnce = false;

function registerConnectionListeners(): void {
  if (listenersRegistered) {
    return;
  }

  const { connection } = mongoose;

  connection.on('connected', () => {
    hasConnectedOnce = true;
    console.log('[workindia-api] MongoDB connected successfully');
  });

  connection.on('error', (error: Error) => {
    console.error('[workindia-api] MongoDB connection error:', error.message);
  });

  connection.on('disconnected', () => {
    if (hasConnectedOnce) {
      console.warn('[workindia-api] MongoDB disconnected');
    }
  });

  listenersRegistered = true;
}

/**
 * Returns true when Mongoose reports an active connection.
 */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === MongooseConnectionStates.connected;
}

/**
 * Human-readable database status for health checks.
 */
export function getDatabaseStatus(): 'connected' | 'disconnected' | 'connecting' | 'disconnecting' {
  switch (mongoose.connection.readyState) {
    case MongooseConnectionStates.connected:
      return 'connected';
    case MongooseConnectionStates.connecting:
      return 'connecting';
    case MongooseConnectionStates.disconnecting:
      return 'disconnecting';
    default:
      return 'disconnected';
  }
}

/**
 * Connect to MongoDB using the centralized MONGODB_URI.
 * Does not log the connection string (may contain credentials).
 */
export async function connectDatabase(): Promise<void> {
  registerConnectionListeners();

  try {
    await mongoose.connect(env.mongodbUri);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error('[workindia-api] Failed to connect to MongoDB:', message);
    throw error;
  }
}

/**
 * Gracefully close the MongoDB connection.
 */
export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === MongooseConnectionStates.disconnected) {
    return;
  }

  await mongoose.disconnect();
}
