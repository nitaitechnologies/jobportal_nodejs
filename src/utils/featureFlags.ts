import { env } from '../config/env';
import {
  AI_FEATURE_CATALOG,
  type AiFeatureEnvKey,
  type AiFeatureKey,
} from '../constants/aiFeatures';
import { settingsService } from '../services/settings.service';

export type AiBlockReason =
  | 'openai_key_missing'
  | 'env_disabled'
  | 'master_disabled'
  | 'admin_disabled';

type AiFlags = { [K in AiFeatureKey]: boolean };

export type FeatureFlags = {
  videoJdEnabled: boolean;
  videoResumeEnabled: boolean;
  videoMaxBytes: number;
  videoMaxSeconds: number;
  chatEnabled: boolean;
} & AiFlags;

function envAllows(envKey: AiFeatureEnvKey): boolean {
  return Boolean(env[envKey]);
}

/**
 * A feature spends OpenAI money only when the API key exists, the deploy-time
 * env switch is on, the admin toggle is on, and (for assistant tools) the
 * employer AI master switch is on.
 */
export function resolveAiEnabled(input: {
  hasOpenAiKey: boolean;
  envOn: boolean;
  adminOn: boolean;
  masterOn: boolean;
}): boolean {
  return input.hasOpenAiKey && input.envOn && input.adminOn && input.masterOn;
}

export function aiBlockReason(input: {
  hasOpenAiKey: boolean;
  envOn: boolean;
  adminOn: boolean;
  masterOn: boolean;
}): AiBlockReason | null {
  if (!input.hasOpenAiKey) return 'openai_key_missing';
  if (!input.envOn) return 'env_disabled';
  if (!input.masterOn) return 'master_disabled';
  if (!input.adminOn) return 'admin_disabled';
  return null;
}

/** Product flags for /me. Clients hide AI actions when a flag is false. */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  const hasOpenAiKey = Boolean(env.openaiApiKey);
  const adminOn = new Map<string, boolean>();

  await Promise.all(
    AI_FEATURE_CATALOG.map(async (item) => {
      adminOn.set(item.settingKey, await settingsService.getBoolean(item.settingKey, true));
    }),
  );

  const ai = {} as AiFlags;
  for (const item of AI_FEATURE_CATALOG) {
    const masterKey =
      'masterSettingKey' in item ? item.masterSettingKey : undefined;
    const masterOn = masterKey ? adminOn.get(masterKey) !== false : true;
    ai[item.key] = resolveAiEnabled({
      hasOpenAiKey,
      envOn: envAllows(item.envKey),
      adminOn: adminOn.get(item.settingKey) !== false,
      masterOn,
    });
  }

  return {
    videoJdEnabled: env.enableVideoJd,
    videoResumeEnabled: env.enableVideoResume,
    videoMaxBytes: env.videoMaxBytes,
    videoMaxSeconds: env.videoMaxSeconds,
    chatEnabled: env.enableChat,
    ...ai,
  };
}

export async function isAiFeatureEnabled(key: AiFeatureKey): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags[key];
}
