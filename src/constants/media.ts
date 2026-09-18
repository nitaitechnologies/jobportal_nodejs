export const MEDIA_CATEGORIES = [
  'candidate_avatar',
  'candidate_resume',
  'candidate_video_resume',
  'job_video_jd',
  'company_logo',
  'company_cover',
  'career_article_image',
] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export const MEDIA_VISIBILITY = ['public', 'private'] as const;
export type MediaVisibility = (typeof MEDIA_VISIBILITY)[number];

export const MEDIA_STATUSES = ['active', 'replaced', 'deleted'] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export const MEDIA_CATEGORY_VISIBILITY: Record<MediaCategory, MediaVisibility> = {
  candidate_avatar: 'public',
  candidate_resume: 'private',
  candidate_video_resume: 'private',
  job_video_jd: 'public',
  company_logo: 'public',
  company_cover: 'public',
  career_article_image: 'public',
};

/** Max sizes in bytes (video categories overridden by VIDEO_MAX_BYTES via getMediaMaxBytes). */
export const MEDIA_MAX_BYTES: Record<MediaCategory, number> = {
  candidate_avatar: 2 * 1024 * 1024, // 2 MB
  candidate_resume: 5 * 1024 * 1024, // 5 MB
  candidate_video_resume: 2 * 1024 * 1024, // 2 MB (default; use getMediaMaxBytes)
  job_video_jd: 2 * 1024 * 1024, // 2 MB (default; use getMediaMaxBytes)
  company_logo: 2 * 1024 * 1024, // 2 MB
  company_cover: 5 * 1024 * 1024, // 5 MB
  career_article_image: 5 * 1024 * 1024, // 5 MB
};

export function isVideoMediaCategory(category: MediaCategory): boolean {
  return category === 'candidate_video_resume' || category === 'job_video_jd';
}

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const RESUME_MIME_TYPES = ['application/pdf'] as const;
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const;

export const MEDIA_ALLOWED_MIME: Record<MediaCategory, readonly string[]> = {
  candidate_avatar: IMAGE_MIME_TYPES,
  candidate_resume: RESUME_MIME_TYPES,
  candidate_video_resume: VIDEO_MIME_TYPES,
  job_video_jd: VIDEO_MIME_TYPES,
  company_logo: IMAGE_MIME_TYPES,
  company_cover: IMAGE_MIME_TYPES,
  career_article_image: IMAGE_MIME_TYPES,
};

export const MEDIA_ALLOWED_EXTENSIONS: Record<MediaCategory, readonly string[]> = {
  candidate_avatar: ['.jpg', '.jpeg', '.png', '.webp'],
  candidate_resume: ['.pdf'],
  // .mov/.m4v: iOS camera often writes MPEG-4 with those names; magic still detects video/mp4.
  candidate_video_resume: ['.mp4', '.webm', '.mov', '.m4v'],
  job_video_jd: ['.mp4', '.webm', '.mov', '.m4v'],
  company_logo: ['.jpg', '.jpeg', '.png', '.webp'],
  company_cover: ['.jpg', '.jpeg', '.png', '.webp'],
  career_article_image: ['.jpg', '.jpeg', '.png', '.webp'],
};

export const BLOCKED_EXTENSIONS = [
  '.exe',
  '.sh',
  '.bat',
  '.cmd',
  '.php',
  '.js',
  '.mjs',
  '.cjs',
  '.html',
  '.htm',
  '.svg',
  '.shtml',
  '.asp',
  '.aspx',
  '.jsp',
  '.cgi',
  '.pl',
  '.py',
  '.rb',
  '.jar',
  '.dll',
  '.so',
  '.wasm',
] as const;

/** Prefix stored in domain string fields for private MediaFile refs. */
export const MEDIA_REF_PREFIX = 'media:';
