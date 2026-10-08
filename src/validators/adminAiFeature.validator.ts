import { z } from 'zod';
import { AI_FEATURE_CATALOG, type AiFeatureKey } from '../constants/aiFeatures';

const shape = Object.fromEntries(
  AI_FEATURE_CATALOG.map((item) => [item.key, z.boolean().optional()]),
) as { [K in AiFeatureKey]: z.ZodOptional<z.ZodBoolean> };

export const adminAiFeatureUpdateSchema = z
  .object(shape)
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one AI feature flag is required' });
    }
  });

export type AdminAiFeatureUpdateInput = z.infer<typeof adminAiFeatureUpdateSchema>;
