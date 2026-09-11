import fs from 'fs/promises';
import path from 'path';
import { env } from '../../config/env';
import type { StorageAdapter, StoredObject } from './types';

function assertSafeStorageKey(storageKey: string): void {
  if (!storageKey || storageKey.includes('..') || storageKey.startsWith('/') || storageKey.includes('\\')) {
    throw new Error('Invalid storage key');
  }
  if (path.isAbsolute(storageKey)) {
    throw new Error('Absolute storage keys are not allowed');
  }
}

/**
 * Local filesystem storage for development.
 * Files live under STORAGE_LOCAL_ROOT (default: storage/uploads).
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly provider = 'local';

  constructor(private readonly rootDir: string) {}

  private absolutePath(storageKey: string): string {
    assertSafeStorageKey(storageKey);
    const resolvedRoot = path.resolve(this.rootDir);
    const full = path.resolve(resolvedRoot, storageKey);
    if (!full.startsWith(resolvedRoot + path.sep) && full !== resolvedRoot) {
      throw new Error('Path traversal blocked');
    }
    return full;
  }

  async upload(input: {
    storageKey: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<StoredObject> {
    const full = this.absolutePath(input.storageKey);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, input.buffer, { flag: 'wx' });
    return { storageKey: input.storageKey, size: input.buffer.length };
  }

  async delete(storageKey: string): Promise<void> {
    const full = this.absolutePath(storageKey);
    try {
      await fs.unlink(full);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await fs.access(this.absolutePath(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  resolvePath(storageKey: string): string {
    return this.absolutePath(storageKey);
  }

  getPublicUrl(storageKey: string): string {
    // Public access goes through the API media route, not raw filesystem URLs.
    void storageKey;
    return '';
  }

  async getSignedUrl(): Promise<string> {
    return '';
  }
}

export function createLocalStorageAdapter(): LocalStorageAdapter {
  return new LocalStorageAdapter(env.storageLocalRoot);
}
