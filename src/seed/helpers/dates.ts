/** Dynamic dates relative to system time at seed run (not a hard-coded calendar year). */

export function demoNow(): Date {
  return new Date();
}

export function daysAgo(days: number, hour = 10): Date {
  const d = demoNow();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour % 24, Math.abs(Math.floor(days * 17)) % 60, 0, 0);
  return d;
}

export function daysFromNow(days: number, hour = 11): Date {
  const d = demoNow();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour % 24, Math.abs(Math.floor(days * 13)) % 60, 0, 0);
  return d;
}

export function spreadOverDays(index: number, total: number, lookbackDays: number): Date {
  const dayOffset = Math.floor((index / Math.max(total, 1)) * lookbackDays);
  return daysAgo(dayOffset % lookbackDays, 8 + (index % 10));
}

/**
 * Spread events with weekday peaks (Mon–Fri heavier) for realistic analytics charts.
 */
export function analyticsOccurredAt(
  rng: () => number,
  lookbackDays: number,
): Date {
  // Bias toward recent days for 7/30-day charts, with a long tail to 90 days.
  const recentBias = rng();
  let dayOffset: number;
  if (recentBias < 0.45) {
    dayOffset = Math.floor(rng() * 7);
  } else if (recentBias < 0.8) {
    dayOffset = 7 + Math.floor(rng() * 23);
  } else {
    dayOffset = 30 + Math.floor(rng() * Math.max(lookbackDays - 30, 1));
  }

  const d = daysAgo(dayOffset, 8 + Math.floor(rng() * 12));
  // If weekend, sometimes shift to a weekday for peak realism.
  const dow = d.getUTCDay(); // 0 Sun … 6 Sat
  if ((dow === 0 || dow === 6) && rng() < 0.65) {
    d.setUTCDate(d.getUTCDate() - (dow === 0 ? 2 : 1));
  }
  return d;
}
