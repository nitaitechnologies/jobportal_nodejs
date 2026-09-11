import { z } from 'zod';
import { isValidPhone, normalizePhone } from '../utils/phone';

export const employerRegisterSchema = z.object({
  name: z
    .union([z.string(), z.undefined(), z.null()])
    .transform((value) => (typeof value === 'string' ? value.trim() : ''))
    .superRefine((value, ctx) => {
      if (!value) {
        ctx.addIssue({ code: 'custom', message: 'Name is required' });
        return;
      }
      if (value.length < 2) {
        ctx.addIssue({ code: 'custom', message: 'Name must be at least 2 characters' });
      }
      if (value.length > 120) {
        ctx.addIssue({ code: 'custom', message: 'Name must be at most 120 characters' });
      }
    }),
  email: z
    .union([z.string(), z.undefined(), z.null()])
    .transform((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .superRefine((value, ctx) => {
      if (!value) {
        ctx.addIssue({ code: 'custom', message: 'Email is required' });
        return;
      }
      if (!z.string().email().safeParse(value).success) {
        ctx.addIssue({ code: 'custom', message: 'Invalid email format' });
      }
    }),
  phone: z
    .union([z.string(), z.undefined(), z.null()])
    .transform((value) => (typeof value === 'string' ? normalizePhone(value) : ''))
    .superRefine((value, ctx) => {
      if (!value) {
        ctx.addIssue({ code: 'custom', message: 'Phone is required' });
        return;
      }
      if (!isValidPhone(value)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Phone must be a valid 10-digit mobile number',
        });
      }
    }),
  password: z
    .union([z.string(), z.undefined(), z.null()])
    .transform((value) => (typeof value === 'string' ? value : ''))
    .superRefine((value, ctx) => {
      if (!value) {
        ctx.addIssue({ code: 'custom', message: 'Password is required' });
        return;
      }
      if (value.length < 8) {
        ctx.addIssue({
          code: 'custom',
          message: 'Password must be at least 8 characters',
        });
      }
      if (value.length > 128) {
        ctx.addIssue({
          code: 'custom',
          message: 'Password must be at most 128 characters',
        });
      }
      if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Password must include at least one letter and one number',
        });
      }
    }),
  companyName: z
    .union([z.string(), z.undefined(), z.null()])
    .transform((value) => (typeof value === 'string' ? value.trim() : ''))
    .superRefine((value, ctx) => {
      if (!value) {
        ctx.addIssue({ code: 'custom', message: 'Company name is required' });
        return;
      }
      if (value.length < 2) {
        ctx.addIssue({
          code: 'custom',
          message: 'Company name must be at least 2 characters',
        });
      }
      if (value.length > 200) {
        ctx.addIssue({
          code: 'custom',
          message: 'Company name must be at most 200 characters',
        });
      }
    }),
});

export const employerLoginSchema = z.object({
  email: z
    .union([z.string(), z.undefined(), z.null()])
    .transform((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .superRefine((value, ctx) => {
      if (!value) {
        ctx.addIssue({ code: 'custom', message: 'Email is required' });
        return;
      }
      if (!z.string().email().safeParse(value).success) {
        ctx.addIssue({ code: 'custom', message: 'Invalid email format' });
      }
    }),
  password: z
    .union([z.string(), z.undefined(), z.null()])
    .transform((value) => (typeof value === 'string' ? value : ''))
    .superRefine((value, ctx) => {
      if (!value) {
        ctx.addIssue({ code: 'custom', message: 'Password is required' });
        return;
      }
      if (value.length < 8) {
        ctx.addIssue({
          code: 'custom',
          message: 'Password must be at least 8 characters',
        });
      }
      if (value.length > 128) {
        ctx.addIssue({
          code: 'custom',
          message: 'Password must be at most 128 characters',
        });
      }
    }),
});

export type EmployerRegisterInput = z.infer<typeof employerRegisterSchema>;
export type EmployerLoginInput = z.infer<typeof employerLoginSchema>;
