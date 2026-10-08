import { z } from 'zod';
import { isValidPhone, normalizePhone } from '../utils/phone';

export const employerTeamInviteSchema = z
  .object({
    email: z.string().trim().email().max(200),
    name: z.string().trim().max(120).optional(),
    teamRole: z.enum(['hr', 'recruiter']),
    department: z.string().trim().max(120).optional(),
  })
  .strict();

export const employerTeamAcceptSchema = z
  .object({
    token: z.string().trim().min(10).max(128),
    name: z.string().trim().min(2).max(120),
    phone: z
      .string()
      .trim()
      .transform((value) => normalizePhone(value))
      .refine((value) => isValidPhone(value), {
        message: 'Phone must be a valid 10-digit mobile number',
      }),
    password: z
      .string()
      .min(8)
      .max(128)
      .refine((value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value), {
        message: 'Password must include at least one letter and one number',
      }),
  })
  .strict();

export const employerTeamRoleUpdateSchema = z
  .object({
    teamRole: z.enum(['hr', 'recruiter']),
  })
  .strict();

export const employerTeamDepartmentUpdateSchema = z
  .object({
    department: z.string().trim().max(120),
  })
  .strict();

export type EmployerTeamInviteInput = z.infer<typeof employerTeamInviteSchema>;
export type EmployerTeamAcceptInput = z.infer<typeof employerTeamAcceptSchema>;
export type EmployerTeamRoleUpdateInput = z.infer<typeof employerTeamRoleUpdateSchema>;
export type EmployerTeamDepartmentUpdateInput = z.infer<typeof employerTeamDepartmentUpdateSchema>;
