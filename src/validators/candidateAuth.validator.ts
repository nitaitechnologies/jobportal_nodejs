import { z } from 'zod';
import { optionalReferralCode } from './referral.validator';
import { isValidPhone, normalizePhone } from '../utils/phone';

export const candidateRegisterSchema = z.object({
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
  /** Optional acquisition channel for admin source metrics (sheet 441). */
  acquisitionSource: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-z0-9_-]+$/i, 'Invalid acquisition source')
    .optional()
    .default('direct'),
  referralCode: optionalReferralCode,
});

export const candidateLoginSchema = z.object({
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

const phoneField = z
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
  });

export const candidateOtpSendSchema = z.object({
  phone: phoneField,
});

export const candidateOtpVerifySchema = z.object({
  phone: phoneField,
  otp: z
    .union([z.string(), z.number(), z.undefined(), z.null()])
    .transform((value) => String(value ?? '').replace(/\D/g, ''))
    .superRefine((value, ctx) => {
      if (!value) {
        ctx.addIssue({ code: 'custom', message: 'OTP is required' });
        return;
      }
      if (!/^\d{4,8}$/.test(value)) {
        ctx.addIssue({ code: 'custom', message: 'OTP must be 4–8 digits' });
      }
    }),
  name: z
    .union([z.string(), z.undefined(), z.null()])
    .transform((value) => (typeof value === 'string' ? value.trim() : ''))
    .superRefine((value, ctx) => {
      if (!value) return;
      if (value.length < 2) {
        ctx.addIssue({ code: 'custom', message: 'Name must be at least 2 characters' });
      }
      if (value.length > 120) {
        ctx.addIssue({ code: 'custom', message: 'Name must be at most 120 characters' });
      }
    })
    .optional(),
  referralCode: optionalReferralCode,
});

const optionalEmailField = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
  .optional();

const optionalPhoneField = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((value) => (typeof value === 'string' ? normalizePhone(value) : ''))
  .optional();

const passwordField = z
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
  });

const otpField = z
  .union([z.string(), z.number(), z.undefined(), z.null()])
  .transform((value) => String(value ?? '').replace(/\D/g, ''))
  .superRefine((value, ctx) => {
    if (!value) {
      ctx.addIssue({ code: 'custom', message: 'OTP is required' });
      return;
    }
    if (!/^\d{4,8}$/.test(value)) {
      ctx.addIssue({ code: 'custom', message: 'OTP must be 4–8 digits' });
    }
  });

function refineEmailOrPhone(
  value: { email?: string; phone?: string },
  ctx: z.RefinementCtx,
): void {
  const email = value.email?.trim() ?? '';
  const phone = value.phone?.trim() ?? '';

  if (email && phone) {
    ctx.addIssue({
      code: 'custom',
      message: 'Provide either email or phone, not both',
      path: ['email'],
    });
    return;
  }

  if (!email && !phone) {
    ctx.addIssue({
      code: 'custom',
      message: 'Email or phone is required',
      path: ['email'],
    });
    return;
  }

  if (email && !z.string().email().safeParse(email).success) {
    ctx.addIssue({ code: 'custom', message: 'Invalid email format', path: ['email'] });
  }

  if (phone && !isValidPhone(phone)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Phone must be a valid 10-digit mobile number',
      path: ['phone'],
    });
  }
}

export const candidatePasswordForgotSchema = z
  .object({
    email: optionalEmailField,
    phone: optionalPhoneField,
  })
  .superRefine(refineEmailOrPhone);

export const candidatePasswordResetSchema = z
  .object({
    email: optionalEmailField,
    phone: optionalPhoneField,
    otp: otpField,
    password: passwordField,
  })
  .superRefine(refineEmailOrPhone);

export const candidateAccountDeleteSchema = z.object({
  confirm: z
    .union([z.boolean(), z.string(), z.undefined(), z.null()])
    .transform((value) => value === true || value === 'true' || value === '1')
    .superRefine((value, ctx) => {
      if (!value) {
        ctx.addIssue({
          code: 'custom',
          message: 'Confirm must be true to delete your account',
        });
      }
    }),
});

export type CandidateRegisterInput = z.infer<typeof candidateRegisterSchema>;
export type CandidateLoginInput = z.infer<typeof candidateLoginSchema>;
export type CandidateOtpSendInput = z.infer<typeof candidateOtpSendSchema>;
export type CandidateOtpVerifyInput = z.infer<typeof candidateOtpVerifySchema>;
export type CandidatePasswordForgotInput = z.infer<typeof candidatePasswordForgotSchema>;
export type CandidatePasswordResetInput = z.infer<typeof candidatePasswordResetSchema>;
export type CandidateAccountDeleteInput = z.infer<typeof candidateAccountDeleteSchema>;
