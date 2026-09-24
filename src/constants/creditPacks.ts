/**
 * Purchasable credit packs + wallet spend costs (sheet 360, 406–409).
 * Defaults live here; runtime overrides via platform settings:
 * - subscriptions.creditPacks (json)
 * - subscriptions.creditCosts (json)
 */
export type CreditPackDef = {
  id: string;
  name: string;
  credits: number;
  price: number;
  description: string;
};

export const DEFAULT_CREDIT_PACKS: CreditPackDef[] = [
  {
    id: 'credits_50',
    name: '50 Credits',
    credits: 50,
    price: 999,
    description: 'Unlock candidate contacts and boost visibility.',
  },
  {
    id: 'credits_150',
    name: '150 Credits',
    credits: 150,
    price: 2499,
    description: 'Best for growing hiring teams.',
  },
  {
    id: 'credits_500',
    name: '500 Credits',
    credits: 500,
    price: 6999,
    description: 'High-volume recruiting pack.',
  },
];

/** Sync fallback catalog (prefer resolveCreditPacks). */
export const CREDIT_PACKS = DEFAULT_CREDIT_PACKS;

export function findCreditPack(
  id: string,
  packs: CreditPackDef[] = DEFAULT_CREDIT_PACKS,
): CreditPackDef | undefined {
  return packs.find((pack) => pack.id === id);
}

export type CreditCosts = {
  contactUnlock: number;
  boostNotify: number;
  featuredJob: number;
};

export const DEFAULT_CREDIT_COSTS: CreditCosts = {
  contactUnlock: 1,
  boostNotify: 5,
  featuredJob: 10,
};

/** Sync fallback costs (prefer resolveCreditCosts). */
export const CREDIT_COSTS = DEFAULT_CREDIT_COSTS;
