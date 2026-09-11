import { z } from 'zod';

export const adminLoginSchema = z.object({
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

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
