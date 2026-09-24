import { IMAGE_MIME_TYPES } from '../constants/media';

const MAX_EDGE = 1920;
const WEBP_QUALITY = 82;

export type OptimizedImage = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  size: number;
};

/**
 * Server-side image optimization (sheet 464).
 * Resizes long edge ≤ 1920 and encodes as WebP when sharp is available.
 * Falls through unchanged on failure so uploads never break.
 */
export async function optimizeImageBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<OptimizedImage | null> {
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return null;
  }

  try {
    const sharp = (await import('sharp')).default;
    const pipeline = sharp(buffer, { failOn: 'none' }).rotate();
    const meta = await pipeline.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    let next = pipeline;
    if (width > MAX_EDGE || height > MAX_EDGE) {
      next = next.resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    const out = await next.webp({ quality: WEBP_QUALITY }).toBuffer();
    return {
      buffer: out,
      mimeType: 'image/webp',
      extension: '.webp',
      size: out.length,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    console.warn(`[media] image optimize skipped: ${reason}`);
    return null;
  }
}
