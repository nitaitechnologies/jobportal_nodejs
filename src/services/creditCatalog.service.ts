import {
  DEFAULT_CREDIT_COSTS,
  DEFAULT_CREDIT_PACKS,
  findCreditPack,
  type CreditCosts,
  type CreditPackDef,
} from '../constants/creditPacks';
import { settingsService } from './settings.service';

function isPack(value: unknown): value is CreditPackDef {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    row.id.trim().length > 0 &&
    typeof row.name === 'string' &&
    typeof row.credits === 'number' &&
    Number.isFinite(row.credits) &&
    row.credits > 0 &&
    typeof row.price === 'number' &&
    Number.isFinite(row.price) &&
    row.price >= 0
  );
}

function normalizeCosts(raw: unknown): CreditCosts {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const pick = (key: keyof CreditCosts, fallback: number) => {
    const n = Number(row[key]);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
  };
  return {
    contactUnlock: pick('contactUnlock', DEFAULT_CREDIT_COSTS.contactUnlock),
    boostNotify: pick('boostNotify', DEFAULT_CREDIT_COSTS.boostNotify),
    featuredJob: pick('featuredJob', DEFAULT_CREDIT_COSTS.featuredJob),
  };
}

export async function resolveCreditPacks(): Promise<CreditPackDef[]> {
  try {
    const raw = await settingsService.getSetting<unknown>(
      'subscriptions.creditPacks',
      DEFAULT_CREDIT_PACKS,
    );
    if (Array.isArray(raw)) {
      const packs = raw.filter(isPack).map((pack) => ({
        id: pack.id.trim(),
        name: String(pack.name).trim() || pack.id,
        credits: Math.floor(pack.credits),
        price: Math.floor(pack.price),
        description: typeof pack.description === 'string' ? pack.description : '',
      }));
      if (packs.length) return packs;
    }
  } catch {
    /* fall through */
  }
  return DEFAULT_CREDIT_PACKS.map((pack) => ({ ...pack }));
}

export async function resolveCreditCosts(): Promise<CreditCosts> {
  try {
    const raw = await settingsService.getSetting<unknown>(
      'subscriptions.creditCosts',
      DEFAULT_CREDIT_COSTS,
    );
    return normalizeCosts(raw);
  } catch {
    return { ...DEFAULT_CREDIT_COSTS };
  }
}

export async function resolveCreditPackById(id: string): Promise<CreditPackDef | undefined> {
  const packs = await resolveCreditPacks();
  return findCreditPack(id, packs);
}
