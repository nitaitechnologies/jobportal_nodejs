import { z } from 'zod';

/** Indian company PAN: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F). */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** GSTIN: 15 chars — 2-digit state + PAN + entity + Z + checksum. */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const COMPANY_DOCUMENT_TYPES = ['pan', 'gst', 'incorporation', 'other'] as const;
export type CompanyDocumentType = (typeof COMPANY_DOCUMENT_TYPES)[number];

export const companyVerificationDetailsSchema = z
  .object({
    pan: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => v === '' || PAN_REGEX.test(v), {
        message: 'PAN must be a valid 10-character Indian PAN',
      })
      .optional(),
    gstin: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => v === '' || GSTIN_REGEX.test(v), {
        message: 'GSTIN must be a valid 15-character GST number',
      })
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.pan === undefined && value.gstin === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Provide pan and/or gstin' });
    }
  });

export const companyDocumentSubmitSchema = z
  .object({
    type: z.enum(COMPANY_DOCUMENT_TYPES),
  })
  .strict();

export type CompanyVerificationDetailsInput = z.infer<typeof companyVerificationDetailsSchema>;
export type CompanyDocumentSubmitInput = z.infer<typeof companyDocumentSubmitSchema>;
