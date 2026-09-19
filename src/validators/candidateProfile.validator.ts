import { z } from 'zod';
import {
  EMPLOYMENT_STATUSES,
  GENDERS,
  PROFILE_VISIBILITY,
} from '../constants/enums';
import { isValidPhone, normalizePhone } from '../utils/phone';

const httpUrl = z
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
    message: 'URL must use http or https',
  });

const optionalUrl = httpUrl;
export const educationItemSchema = z
  .object({
    degree: z.string().trim().min(1).max(120),
    fieldOfStudy: z.string().trim().max(120).optional().default(''),
    institution: z.string().trim().min(1).max(200),
    startYear: z.number().int().min(1950).max(2100).optional(),
    endYear: z.number().int().min(1950).max(2100).optional(),
    grade: z.string().trim().max(50).optional().default(''),
    description: z.string().trim().max(2000).optional().default(''),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.startYear !== undefined &&
      value.endYear !== undefined &&
      value.endYear < value.startYear
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['endYear'],
        message: 'endYear must be on or after startYear',
      });
    }
  });

export const workExperienceItemSchema = z
  .object({
    jobTitle: z.string().trim().min(1).max(120),
    company: z.string().trim().min(1).max(200),
    location: z.string().trim().max(200).optional().default(''),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional().nullable(),
    isCurrent: z.boolean().optional().default(false),
    description: z.string().trim().max(5000).optional().default(''),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.isCurrent) {
      return;
    }
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'endDate must be on or after startDate',
        path: ['endDate'],
      });
    }
  });

export const certificationItemSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    issuer: z.string().trim().max(200).optional().default(''),
    issueDate: z.coerce.date().optional(),
    expiryDate: z.coerce.date().optional(),
    credentialId: z.string().trim().max(120).optional().default(''),
    credentialUrl: optionalUrl.optional().default(''),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.issueDate && value.expiryDate && value.expiryDate < value.issueDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiryDate'],
        message: 'expiryDate must be on or after issueDate',
      });
    }
  });

export const languageItemSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    proficiency: z
      .enum(['basic', 'conversational', 'fluent', 'native'])
      .default('conversational'),
  })
  .strict();

const socialLinksSchema = z
  .object({
    linkedin: optionalUrl.optional(),
    twitter: optionalUrl.optional(),
    facebook: optionalUrl.optional(),
    instagram: optionalUrl.optional(),
    github: optionalUrl.optional(),
    website: optionalUrl.optional(),
  })
  .strict();

const skillsArraySchema = z
  .array(z.string().trim().min(1).max(80))
  .max(50)
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

export const candidateProfileUpdateSchema = z
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
    headline: z.string().trim().max(200).optional(),
    bio: z.string().trim().max(5000).optional(),
    profilePhoto: z.string().trim().max(500).optional(),
    dateOfBirth: z.coerce.date().optional().nullable(),
    gender: z.enum(GENDERS).optional(),
    currentLocation: z.string().trim().max(200).optional(),
    locationPlaceId: z.string().trim().min(3).max(300).optional(),
    preferredLocations: z
      .array(z.string().trim().min(1).max(120))
      .max(20)
      .transform((items) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))))
      .optional(),
    currentJobTitle: z.string().trim().max(120).optional(),
    currentCompany: z.string().trim().max(200).optional(),
    totalExperience: z.number().min(0).max(60).optional(),
    expectedSalary: z.number().min(0).max(100_000_000).optional().nullable(),
    noticePeriod: z.number().int().min(0).max(365).optional(),
    availableFrom: z.coerce.date().optional().nullable(),
    employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
    skills: skillsArraySchema.optional(),
    education: z.array(educationItemSchema).max(20).optional(),
    workExperience: z.array(workExperienceItemSchema).max(30).optional(),
    certifications: z.array(certificationItemSchema).max(30).optional(),
    languages: z
      .array(languageItemSchema)
      .max(20)
      .transform((items) => {
        const unique: typeof items = [];
        const seen = new Set<string>();
        for (const item of items) {
          const key = item.name.trim().toLowerCase();
          if (!key || seen.has(key)) {
            continue;
          }
          seen.add(key);
          unique.push({ ...item, name: item.name.trim() });
        }
        return unique;
      })
      .optional(),
    portfolio: optionalUrl.optional(),
    socialLinks: socialLinksSchema.optional(),
    profileVisibility: z.enum(PROFILE_VISIBILITY).optional(),
    resume: optionalUrl.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one profile field is required',
      });
    }
  });

export const skillCreateSchema = z
  .object({
    skill: z.string().trim().min(1).max(80),
  })
  .strict();

export const educationCreateSchema = educationItemSchema;

export const educationUpdateSchema = z
  .object({
    degree: z.string().trim().min(1).max(120).optional(),
    fieldOfStudy: z.string().trim().max(120).optional(),
    institution: z.string().trim().min(1).max(200).optional(),
    startYear: z.number().int().min(1950).max(2100).optional(),
    endYear: z.number().int().min(1950).max(2100).optional(),
    grade: z.string().trim().max(50).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
    if (
      value.startYear !== undefined &&
      value.endYear !== undefined &&
      value.endYear < value.startYear
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['endYear'],
        message: 'endYear must be on or after startYear',
      });
    }
  });

export const experienceCreateSchema = workExperienceItemSchema;

export const experienceUpdateSchema = z
  .object({
    jobTitle: z.string().trim().min(1).max(120).optional(),
    company: z.string().trim().min(1).max(200).optional(),
    location: z.string().trim().max(200).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional().nullable(),
    isCurrent: z.boolean().optional(),
    description: z.string().trim().max(5000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
    if (
      !value.isCurrent &&
      value.startDate &&
      value.endDate &&
      value.endDate < value.startDate
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'endDate must be on or after startDate',
      });
    }
  });

export const certificationCreateSchema = certificationItemSchema;

export const certificationUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    issuer: z.string().trim().max(200).optional(),
    issueDate: z.coerce.date().optional(),
    expiryDate: z.coerce.date().optional(),
    credentialId: z.string().trim().max(120).optional(),
    credentialUrl: optionalUrl.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
    if (value.issueDate && value.expiryDate && value.expiryDate < value.issueDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiryDate'],
        message: 'expiryDate must be on or after issueDate',
      });
    }
  });

export type CandidateProfileUpdateInput = z.infer<typeof candidateProfileUpdateSchema>;
export type SkillCreateInput = z.infer<typeof skillCreateSchema>;
export type EducationCreateInput = z.infer<typeof educationCreateSchema>;
export type EducationUpdateInput = z.infer<typeof educationUpdateSchema>;
export type ExperienceCreateInput = z.infer<typeof experienceCreateSchema>;
export type ExperienceUpdateInput = z.infer<typeof experienceUpdateSchema>;
export type CertificationCreateInput = z.infer<typeof certificationCreateSchema>;
export type CertificationUpdateInput = z.infer<typeof certificationUpdateSchema>;
