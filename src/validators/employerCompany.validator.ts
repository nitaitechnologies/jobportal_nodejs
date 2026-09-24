import { z } from 'zod';
import { COMPANY_SIZES } from '../constants/enums';
import { isValidPhone, normalizePhone } from '../utils/phone';
import { httpUrlSchema } from '../utils/validation';

const optionalUrl = httpUrlSchema;

const socialLinksSchema = z.object({
  linkedin: optionalUrl.optional(),
  twitter: optionalUrl.optional(),
  facebook: optionalUrl.optional(),
  instagram: optionalUrl.optional(),
  github: optionalUrl.optional(),
  website: optionalUrl.optional(),
});

/** Public media path (`/api/v1/media/public/:id`) or absolute http(s) URL. */
function isGalleryMediaUrl(value: string): boolean {
  const trimmed = value.trim();
  if (/^\/api\/v1\/media\/public\/[a-fA-F0-9]{24}$/.test(trimmed)) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const employerProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    phone: z
      .string()
      .trim()
      .transform((value) => normalizePhone(value))
      .refine((value) => isValidPhone(value), {
        message: 'Phone must be a valid 10-digit mobile number',
      })
      .optional(),
    avatar: z.string().trim().max(500).optional(),
    designation: z.string().trim().max(120).optional(),
    department: z.string().trim().max(120).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one profile field is required' });
    }
  });

export const companyProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(10000).optional(),
    website: optionalUrl.optional(),
    industry: z.string().trim().max(120).optional(),
    companySize: z.enum(COMPANY_SIZES).optional(),
    foundedYear: z.number().int().min(1800).max(2100).optional().nullable(),
    headquarters: z.string().trim().max(200).optional(),
    locations: z
      .array(z.string().trim().min(1).max(120))
      .max(30)
      .transform((items) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))))
      .optional(),
    contactEmail: z
      .string()
      .trim()
      .toLowerCase()
      .refine((value) => value === '' || z.string().email().safeParse(value).success, {
        message: 'Invalid email format',
      })
      .optional(),
    contactPhone: z
      .string()
      .trim()
      .transform((value) => (value ? normalizePhone(value) : ''))
      .refine((value) => value === '' || isValidPhone(value), {
        message: 'Phone must be a valid 10-digit mobile number',
      })
      .optional(),
    socialLinks: socialLinksSchema.optional(),
    logo: z.string().trim().max(500).optional(),
    coverImage: z.string().trim().max(500).optional(),
    benefits: z
      .array(z.string().trim().min(1).max(120))
      .max(30)
      .transform((items) => Array.from(new Set(items.map((i) => i.trim()).filter(Boolean))))
      .optional(),
    gallery: z
      .array(
        z.object({
          url: z
            .string()
            .trim()
            .max(500)
            .refine((value) => isGalleryMediaUrl(value), {
              message: 'gallery url must be https or a public media path',
            }),
          type: z.enum(['image', 'video']).optional().default('image'),
          caption: z.string().trim().max(200).optional().default(''),
          sortOrder: z.number().int().min(0).max(100).optional(),
        }),
      )
      .max(20)
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one company field is required' });
    }
  });

export type EmployerProfileUpdateInput = z.infer<typeof employerProfileUpdateSchema>;
export type CompanyProfileUpdateInput = z.infer<typeof companyProfileUpdateSchema>;

export const companyReviewCreateSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().max(120).optional().default(''),
    body: z.string().trim().min(10).max(5000),
  })
  .strict();

export const companyReviewUpdateSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    title: z.string().trim().max(120).optional(),
    body: z.string().trim().min(10).max(5000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
  });

export const companyReviewsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  })
  .strict();

export const companyJobsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .strict();

export type CompanyReviewCreateInput = z.infer<typeof companyReviewCreateSchema>;
export type CompanyReviewUpdateInput = z.infer<typeof companyReviewUpdateSchema>;
export type CompanyReviewsQuery = z.infer<typeof companyReviewsQuerySchema>;
export type CompanyJobsQuery = z.infer<typeof companyJobsQuerySchema>;

export const EMPLOYER_PROFILE_FORBIDDEN_FIELDS = [
  'email',
  'role',
  'password',
  'passwordHash',
  'status',
  'verified',
  'userId',
  'companyId',
  '_id',
  'id',
  'emailVerified',
  'phoneVerified',
  'lastLoginAt',
  'deletedAt',
  'createdAt',
  'updatedAt',
] as const;

export const COMPANY_PROFILE_FORBIDDEN_FIELDS = [
  'slug',
  'verificationStatus',
  'status',
  'userId',
  'companyId',
  'employerId',
  'ratingAvg',
  'ratingCount',
  '_id',
  'id',
  'createdAt',
  'updatedAt',
  'profileCompletion',
] as const;
