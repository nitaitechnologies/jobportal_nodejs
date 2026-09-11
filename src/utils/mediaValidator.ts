import path from 'path';
import { HTTP_STATUS } from '../constants';
import {
  BLOCKED_EXTENSIONS,
  MEDIA_ALLOWED_EXTENSIONS,
  MEDIA_ALLOWED_MIME,
  MEDIA_CATEGORIES,
  MEDIA_MAX_BYTES,
  type MediaCategory,
} from '../constants/media';
import { AppError } from './AppError';

function detectMimeFromMagic(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  // PDF
  if (buffer.subarray(0, 4).toString('ascii') === '%PDF') {
    return 'application/pdf';
  }

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

export function normalizeExtension(originalName: string): string {
  const ext = path.extname(originalName || '').toLowerCase();
  return ext;
}

export function sanitizeOriginalName(originalName: string): string {
  const base = path.basename(originalName || 'file').replace(/[^\w.\-()+ ]+/g, '_');
  return base.slice(0, 180) || 'file';
}

export function assertMediaCategory(category: string): asserts category is MediaCategory {
  if (!(MEDIA_CATEGORIES as readonly string[]).includes(category)) {
    throw new AppError('Unsupported media category', HTTP_STATUS.BAD_REQUEST, [
      { path: 'category', message: 'Invalid category' },
    ]);
  }
}

export interface ValidatedUploadFile {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  originalName: string;
  size: number;
  category: MediaCategory;
}

/**
 * Validate an uploaded file for a controlled category.
 * Does not trust client MIME alone — checks magic bytes where possible.
 */
export function validateUploadedFile(input: {
  category: MediaCategory;
  originalName: string;
  declaredMime: string;
  buffer: Buffer;
  size: number;
}): ValidatedUploadFile {
  const category = input.category;
  const max = MEDIA_MAX_BYTES[category];
  if (!input.buffer?.length || input.size <= 0) {
    throw new AppError('Empty file is not allowed', HTTP_STATUS.BAD_REQUEST);
  }
  if (input.size > max) {
    throw new AppError('File too large', HTTP_STATUS.BAD_REQUEST, [
      {
        path: 'file',
        message: `Maximum size for ${category} is ${Math.round(max / (1024 * 1024))}MB`,
      },
    ]);
  }

  const originalName = sanitizeOriginalName(input.originalName);
  const extension = normalizeExtension(originalName);
  if (!extension) {
    throw new AppError('File extension is required', HTTP_STATUS.BAD_REQUEST);
  }
  if ((BLOCKED_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new AppError('File type is not allowed', HTTP_STATUS.BAD_REQUEST, [
      { path: 'file', message: `Extension ${extension} is blocked` },
    ]);
  }
  if (!(MEDIA_ALLOWED_EXTENSIONS[category] as readonly string[]).includes(extension)) {
    throw new AppError('Unsupported file extension', HTTP_STATUS.BAD_REQUEST, [
      {
        path: 'file',
        message: `Allowed: ${MEDIA_ALLOWED_EXTENSIONS[category].join(', ')}`,
      },
    ]);
  }

  const detected = detectMimeFromMagic(input.buffer);
  const declared = (input.declaredMime || '').toLowerCase().split(';')[0].trim();
  const allowed = MEDIA_ALLOWED_MIME[category];

  if (!detected) {
    throw new AppError('Unable to verify file type', HTTP_STATUS.BAD_REQUEST, [
      { path: 'file', message: 'Unrecognized or unsupported file signature' },
    ]);
  }

  if (!(allowed as readonly string[]).includes(detected)) {
    throw new AppError('Unsupported file type', HTTP_STATUS.BAD_REQUEST, [
      { path: 'file', message: `Detected type ${detected} is not allowed for ${category}` },
    ]);
  }

  // If client declared a MIME, it must match the detected family.
  if (declared && declared !== 'application/octet-stream' && declared !== detected) {
    // Allow jpeg aliases
    const jpegFamily =
      detected === 'image/jpeg' && (declared === 'image/jpg' || declared === 'image/pjpeg');
    if (!jpegFamily) {
      throw new AppError('MIME type mismatch', HTTP_STATUS.BAD_REQUEST, [
        {
          path: 'file',
          message: `Declared ${declared} does not match file contents (${detected})`,
        },
      ]);
    }
  }

  // Extension must align with detected mime
  const extForMime: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'application/pdf': ['.pdf'],
  };
  if (!(extForMime[detected] ?? []).includes(extension)) {
    throw new AppError('Extension does not match file contents', HTTP_STATUS.BAD_REQUEST);
  }

  return {
    buffer: input.buffer,
    mimeType: detected,
    extension,
    originalName,
    size: input.size,
    category,
  };
}
