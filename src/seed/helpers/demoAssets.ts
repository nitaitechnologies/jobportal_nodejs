import fs from 'fs/promises';
import path from 'path';
import { env } from '../../config/env';

/** 1×1 PNG (valid image/png). */
export const DEMO_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Minimal valid-enough PDF for demo resume downloads. */
export const DEMO_PDF_BUFFER = Buffer.from(
  [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj',
    '3 0 obj<</Type/Page/MediaBox[0 0 400 200]/Parent 2 0 R>>endobj',
    'xref',
    '0 4',
    '0000000000 65535 f ',
    'trailer<</Size 4/Root 1 0 R>>',
    'startxref',
    '0',
    '%%EOF',
  ].join('\n'),
  'utf8',
);

/**
 * Idempotently write a demo file under STORAGE_LOCAL_ROOT.
 * Does not use storage.upload wx flag (safe for re-seed).
 */
export async function ensureDemoFile(storageKey: string, buffer: Buffer): Promise<void> {
  if (!storageKey || storageKey.includes('..') || storageKey.startsWith('/')) {
    throw new Error(`Unsafe demo storage key: ${storageKey}`);
  }
  const root = path.resolve(env.storageLocalRoot);
  const full = path.resolve(root, storageKey);
  if (!full.startsWith(root + path.sep) && full !== root) {
    throw new Error('Path traversal blocked for demo asset');
  }
  await fs.mkdir(path.dirname(full), { recursive: true });
  try {
    await fs.access(full);
  } catch {
    await fs.writeFile(full, buffer);
  }
}

export async function demoFileExists(storageKey: string): Promise<boolean> {
  const root = path.resolve(env.storageLocalRoot);
  const full = path.resolve(root, storageKey);
  try {
    await fs.access(full);
    return true;
  } catch {
    return false;
  }
}
