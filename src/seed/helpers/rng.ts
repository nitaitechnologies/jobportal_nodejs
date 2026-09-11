/**
 * Deterministic PRNG (mulberry32) so re-seeds produce the same dataset shape.
 */
export function createSeededRng(seed = 20250911): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('Cannot pick from empty list');
  }
  return items[Math.floor(rng() * items.length)]!;
}

export function pickN<T>(rng: () => number, items: readonly T[], n: number): T[] {
  const copy = [...items];
  const result: T[] = [];
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i += 1) {
    const idx = Math.floor(rng() * copy.length);
    result.push(copy.splice(idx, 1)[0]!);
  }
  return result;
}

export function chance(rng: () => number, probability: number): boolean {
  return rng() < probability;
}

export function intBetween(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
