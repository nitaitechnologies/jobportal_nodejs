import type { MediaCategory, MediaVisibility } from '../constants/media';
import { MEDIA_REF_PREFIX } from '../constants/media';
import { env } from '../config/env';

export function isMediaRef(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(MEDIA_REF_PREFIX));
}

export function toMediaRef(mediaId: string): string {
  return `${MEDIA_REF_PREFIX}${mediaId}`;
}

export function parseMediaRef(value: string | null | undefined): string | null {
  if (!value || !value.startsWith(MEDIA_REF_PREFIX)) return null;
  const id = value.slice(MEDIA_REF_PREFIX.length);
  return /^[a-fA-F0-9]{24}$/.test(id) ? id : null;
}

export function publicMediaUrl(mediaId: string): string {
  return `${env.apiPrefix}/media/public/${mediaId}`;
}

export function mapSafeMedia(doc: {
  _id: { toString(): string };
  category: string;
  originalName: string;
  mimeType: string;
  size: number;
  visibility: string;
  uploadedAt?: Date | null;
  createdAt?: Date | null;
  status?: string;
}) {
  const id = doc._id.toString();
  const visibility = doc.visibility as MediaVisibility;
  return {
    id,
    category: doc.category as MediaCategory,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    size: doc.size,
    visibility,
    uploadedAt: doc.uploadedAt ?? doc.createdAt ?? null,
    url: visibility === 'public' ? publicMediaUrl(id) : null,
  };
}
