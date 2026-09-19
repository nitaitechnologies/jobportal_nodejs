const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfLocalDay(value = new Date()): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Days from today until `date`, clamped to the existing 0–365 notice window. */
export function noticeDaysUntil(date: Date): number {
  const days = Math.ceil((startOfLocalDay(date).getTime() - startOfLocalDay().getTime()) / DAY_MS);
  return Math.max(0, Math.min(365, days));
}

export function dateFromNoticeDays(days: number): Date {
  const date = startOfLocalDay();
  date.setDate(date.getDate() + Math.max(0, Math.min(365, Math.round(days))));
  return date;
}
