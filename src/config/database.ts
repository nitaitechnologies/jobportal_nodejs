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
    console.log(`[${env.serviceName}] MongoDB connected successfully`);
  });

  connection.on('error', (error: Error) => {
    console.error(`[${env.serviceName}] MongoDB connection error:`, error.message);
  });

  connection.on('disconnected', () => {
    if (hasConnectedOnce) {
      console.warn(`[${env.serviceName}] MongoDB disconnected`);
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
 * Drop the legacy global phone unique index so the same number can be
 * candidate + employer. Safe to call repeatedly. New (phone, role) unique
 * index is created by the User model via mongoose autoIndex / sync on use.
 */
async function migratePhoneUniqueIndex(): Promise<void> {
  try {
    const collection = mongoose.connection.collection('users');
    const indexes = await collection.indexes();
    const legacy = indexes.find(
      (idx) =>
        idx.name === 'phone_1' ||
        (idx.unique === true &&
          idx.key &&
          Object.keys(idx.key).length === 1 &&
          (idx.key as Record<string, number>).phone === 1),
    );
    if (legacy?.name) {
      await collection.dropIndex(legacy.name);
      console.log(`[${env.serviceName}] Dropped legacy users index ${legacy.name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Index missing is fine; anything else is non-fatal for boot.
    if (!/index not found/i.test(message)) {
      console.warn(`[${env.serviceName}] Phone index migrate skipped:`, message);
    }
  }
}

/**
 * Connect to MongoDB using the centralized MONGODB_URI.
 * Does not log the connection string (may contain credentials).
 */
export async function connectDatabase(): Promise<void> {
  registerConnectionListeners();

  try {
    await mongoose.connect(env.mongodbUri, {
      // Keep local/dev connections stable under scraper load / brief Mongo pauses.
      serverSelectionTimeoutMS: 10_000,
      heartbeatFrequencyMS: 10_000,
      maxPoolSize: 20,
      minPoolSize: 1,
      socketTimeoutMS: 45_000,
    });
    await migratePhoneUniqueIndex();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[${env.serviceName}] Failed to connect to MongoDB:`, message);
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
