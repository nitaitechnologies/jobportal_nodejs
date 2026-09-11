import { env } from '../../config/env';
import { createLocalStorageAdapter } from './localStorage.adapter';
import type { StorageAdapter } from './types';

let cached: StorageAdapter | null = null;

/**
 * Resolve the configured storage adapter.
 * Domain code must depend on StorageAdapter — never on a specific provider.
 */
export function getStorageAdapter(): StorageAdapter {
  if (cached) return cached;

  switch (env.storageProvider) {
    case 'local':
      cached = createLocalStorageAdapter();
      break;
    // Future: case 's3': case 'r2':
    default:
      cached = createLocalStorageAdapter();
      break;
  }

  return cached;
}

export type { StorageAdapter, StoredObject } from './types';
