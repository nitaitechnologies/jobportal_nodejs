import { HTTP_STATUS } from '../constants';
import { env } from '../config/env';
import {
  AI_FEATURE_CATALOG,
  aiFeatureByKey,
  type AiFeatureKey,
} from '../constants/aiFeatures';
import type { AuthenticatedAdmin } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { aiBlockReason, getFeatureFlags } from '../utils/featureFlags';
import { ensureDefaultSettings, settingsService } from './settings.service';

export class AdminAiFeatureService {
  async list() {
    await ensureDefaultSettings();
    const effective = await getFeatureFlags();
    const adminOn = new Map<string, boolean>();
    await Promise.all(
      AI_FEATURE_CATALOG.map(async (item) => {
        adminOn.set(item.settingKey, await settingsService.getBoolean(item.settingKey, true));
      }),
    );
    const hasOpenAiKey = Boolean(env.openaiApiKey);

    return {
      features: effective,
      toggles: AI_FEATURE_CATALOG.map((item) => {
        const envOn = Boolean(env[item.envKey]);
        const stored = adminOn.get(item.settingKey) !== false;
        const masterKey = 'masterSettingKey' in item ? item.masterSettingKey : undefined;
        const masterOn = masterKey ? adminOn.get(masterKey) !== false : true;
        return {
          key: item.key,
          label: item.label,
          description: item.description,
          audience: item.audience,
          enabled: effective[item.key],
          adminEnabled: stored,
          envEnabled: envOn,
          providerReady: hasOpenAiKey,
          blockedReason: aiBlockReason({
            hasOpenAiKey,
            envOn,
            adminOn: stored,
            masterOn,
          }),
        };
      }),
    };
  }

  async update(admin: AuthenticatedAdmin, input: Partial<Record<AiFeatureKey, boolean>>) {
    const entries = Object.entries(input).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      throw new AppError('At least one AI feature flag is required', HTTP_STATUS.BAD_REQUEST);
    }

    await ensureDefaultSettings();

    for (const [key, value] of entries) {
      const item = aiFeatureByKey(key);
      if (!item || typeof value !== 'boolean') {
        throw new AppError(`Unknown AI feature: ${key}`, HTTP_STATUS.BAD_REQUEST);
      }
      await settingsService.update(admin, item.settingKey, { value });
    }

    return this.list();
  }
}

export const adminAiFeatureService = new AdminAiFeatureService();
