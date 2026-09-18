import crypto from 'crypto';
import mongoose from 'mongoose';
import path from 'path';
import { HTTP_STATUS } from '../constants';
import {
  MEDIA_CATEGORY_VISIBILITY,
  MEDIA_REF_PREFIX,
  type MediaCategory,
} from '../constants/media';
import { MediaFile } from '../models/MediaFile';
import { AppError } from '../utils/AppError';
import { mapSafeMedia, parseMediaRef, publicMediaUrl, toMediaRef } from '../utils/mediaMapper';
import { validateUploadedFile } from '../utils/mediaValidator';
import { getStorageAdapter } from './storage';

export interface UploadMediaInput {
  category: MediaCategory;
  ownerUserId: string;
  ownerType: 'candidate' | 'employer' | 'admin';
  entityType: 'candidate' | 'user' | 'company' | 'article' | 'job' | 'application';
  entityId: string;
  originalName: string;
  declaredMime: string;
  buffer: Buffer;
  size: number;
  /** Previous domain field value (URL or media:id) for cleanup. */
  previousRef?: string | null;
  /** Client-declared video duration in seconds (enforced for video categories). */
  durationSeconds?: number;
}

function buildStorageKey(category: MediaCategory, extension: string): string {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const id = crypto.randomUUID();
  const ext = extension.startsWith('.') ? extension.slice(1) : extension;
  return path.posix.join(category, yyyy, mm, `${id}.${ext}`);
}

async function markReplacedAndCleanup(previousRef: string | null | undefined): Promise<void> {
  const mediaId = parseMediaRef(previousRef);
  if (!mediaId) {
    // Legacy URL string — leave as-is (no MediaFile to clean).
    return;
  }

  const previous = await MediaFile.findById(mediaId);
  if (!previous || previous.status !== 'active') return;

  previous.status = 'replaced';
  await previous.save();

  try {
    await getStorageAdapter().delete(previous.storageKey);
    previous.status = 'deleted';
    await previous.save();
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    console.error(`[media] failed to delete replaced file ${mediaId}: ${reason}`);
  }
}

/**
 * Upload a validated file, persist MediaFile, and return safe serializer + domain ref.
 */
export async function uploadMedia(input: UploadMediaInput) {
  const validated = validateUploadedFile({
    category: input.category,
    originalName: input.originalName,
    declaredMime: input.declaredMime,
    buffer: input.buffer,
    size: input.size,
    durationSeconds: input.durationSeconds,
  });

  const storage = getStorageAdapter();
  const storageKey = buildStorageKey(validated.category, validated.extension);
  const visibility = MEDIA_CATEGORY_VISIBILITY[validated.category];

  await storage.upload({
    storageKey,
    buffer: validated.buffer,
    mimeType: validated.mimeType,
  });

  let media;
  try {
    media = await MediaFile.create({
      ownerUserId: new mongoose.Types.ObjectId(input.ownerUserId),
      ownerType: input.ownerType,
      entityType: input.entityType,
      entityId: new mongoose.Types.ObjectId(input.entityId),
      category: validated.category,
      visibility,
      originalName: validated.originalName,
      storedName: path.posix.basename(storageKey),
      mimeType: validated.mimeType,
      extension: validated.extension,
      size: validated.size,
      storageProvider: storage.provider,
      storageKey,
      status: 'active',
      uploadedAt: new Date(),
    });
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }

  // Best-effort cleanup of previous media after DB success.
  await markReplacedAndCleanup(input.previousRef);

  const safe = mapSafeMedia(media);
  const domainRef =
    visibility === 'public' ? publicMediaUrl(media._id.toString()) : toMediaRef(media._id.toString());

  console.info(
    `[media] uploaded category=${validated.category} mediaId=${media._id.toString()} ownerType=${input.ownerType} provider=${storage.provider}`,
  );

  return {
    media: safe,
    domainRef,
    mediaId: media._id.toString(),
  };
}

export async function getActiveMediaById(mediaId: string) {
  if (!mongoose.Types.ObjectId.isValid(mediaId)) {
    throw new AppError('File not found', HTTP_STATUS.NOT_FOUND);
  }
  const media = await MediaFile.findOne({ _id: mediaId, status: 'active' });
  if (!media) {
    throw new AppError('File not found', HTTP_STATUS.NOT_FOUND);
  }
  return media;
}

export async function readMediaBuffer(mediaId: string) {
  const media = await getActiveMediaById(mediaId);
  const storage = getStorageAdapter();
  const fullPath = storage.resolvePath(media.storageKey);
  const fs = await import('fs/promises');
  const buffer = await fs.readFile(fullPath);
  return { media, buffer };
}

export async function deleteMediaByRef(
  ref: string | null | undefined,
  opts?: { ownerUserId?: string },
): Promise<void> {
  const mediaId = parseMediaRef(ref);
  // Also accept bare public URL ending with media id
  let id = mediaId;
  if (!id && ref) {
    const match = ref.match(/\/media\/public\/([a-fA-F0-9]{24})$/);
    if (match) id = match[1];
  }
  if (!id) {
    return;
  }

  const media = await MediaFile.findById(id);
  if (!media || media.status === 'deleted') return;

  if (opts?.ownerUserId && media.ownerUserId.toString() !== opts.ownerUserId) {
    throw new AppError('File access denied', HTTP_STATUS.FORBIDDEN);
  }

  try {
    await getStorageAdapter().delete(media.storageKey);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    console.error(`[media] storage delete failed for ${id}: ${reason}`);
  }

  media.status = 'deleted';
  await media.save();
}

export function hasStoredMedia(ref: string | null | undefined): boolean {
  if (!ref || !ref.trim()) return false;
  if (ref.startsWith(MEDIA_REF_PREFIX)) return true;
  if (/\/media\/public\/[a-fA-F0-9]{24}$/.test(ref)) return true;
  // Legacy http(s) URL
  return /^https?:\/\//i.test(ref);
}
