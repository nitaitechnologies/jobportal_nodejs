import { z } from 'zod';
import { ARTICLE_STATUSES } from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const httpsOrHttpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    if (value === '') {
      return true;
    }
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, {
    message: 'Image URL must use http or https',
  });

const tagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .transform((items) => {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      const trimmed = item.trim();
      const key = trimmed.toLowerCase();
      if (!trimmed || seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(trimmed);
    }
    return unique;
  });

export const careerArticleCreateSchema = z
  .object({
    title: z.string().trim().min(5).max(200),
    excerpt: z.string().trim().max(500).optional().default(''),
    content: z.string().trim().min(20).max(100_000),
    featuredImage: httpsOrHttpUrl.optional().default(''),
    category: z.string().trim().max(120).optional().default(''),
    tags: tagsSchema.optional().default([]),
    seoTitle: z.string().trim().max(70).optional().default(''),
    seoDescription: z.string().trim().max(160).optional().default(''),
  })
  .strict();

export const careerArticleUpdateSchema = z
  .object({
    title: z.string().trim().min(5).max(200).optional(),
    excerpt: z.string().trim().max(500).optional(),
    content: z.string().trim().min(20).max(100_000).optional(),
    featuredImage: httpsOrHttpUrl.optional(),
    category: z.string().trim().max(120).optional(),
    tags: tagsSchema.optional(),
    seoTitle: z.string().trim().max(70).optional(),
    seoDescription: z.string().trim().max(160).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one field is required',
      });
    }
  });

export const publicCareerAdviceQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
    category: z.string().trim().max(120).optional(),
    tag: z.string().trim().max(40).optional(),
    q: z.string().trim().max(100).optional(),
    sort: z.enum(['latest', 'oldest', 'popular']).optional().default('latest'),
  })
  .strict();

export const adminCareerAdviceQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(ARTICLE_STATUSES).optional(),
    category: z.string().trim().max(120).optional(),
    q: z.string().trim().max(100).optional(),
  })
  .strict();

export const careerArticleIdParamSchema = z.object({
  id: objectIdSchema,
});

export const careerArticleSlugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(220)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format'),
});

export const CAREER_ARTICLE_FORBIDDEN_FIELDS = [
  'slug',
  'authorId',
  'status',
  'publishedAt',
  'views',
  'createdAt',
  'updatedAt',
  '_id',
  'id',
] as const;

export type CareerArticleCreateInput = z.infer<typeof careerArticleCreateSchema>;
export type CareerArticleUpdateInput = z.infer<typeof careerArticleUpdateSchema>;
export type PublicCareerAdviceQuery = z.infer<typeof publicCareerAdviceQuerySchema>;
export type AdminCareerAdviceQuery = z.infer<typeof adminCareerAdviceQuerySchema>;
