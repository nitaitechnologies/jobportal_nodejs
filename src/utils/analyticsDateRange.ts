import type {
  AnalyticsDatePreset,
  AnalyticsGranularity,
} from '../constants/enums';
import { AppError } from './AppError';
import { HTTP_STATUS } from '../constants';

export interface DateRange {
  from: Date;
  to: Date;
}

/** Inclusive UTC day start / exclusive next-day end for `to` day. */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function resolveAnalyticsDateRange(input: {
  preset?: AnalyticsDatePreset;
  from?: string;
  to?: string;
}): DateRange {
  const preset = input.preset ?? 'last_30_days';
  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const tomorrow = addUtcDays(todayStart, 1);

  if (preset === 'today') {
    return { from: todayStart, to: tomorrow };
  }
  if (preset === 'last_7_days') {
    return { from: addUtcDays(todayStart, -6), to: tomorrow };
  }
  if (preset === 'last_30_days') {
    return { from: addUtcDays(todayStart, -29), to: tomorrow };
  }
  if (preset === 'last_90_days') {
    return { from: addUtcDays(todayStart, -89), to: tomorrow };
  }

  // custom
  if (!input.from || !input.to) {
    throw new AppError('Custom range requires from and to (ISO dates)', HTTP_STATUS.BAD_REQUEST, [
      { path: 'from', message: 'Required for custom range' },
      { path: 'to', message: 'Required for custom range' },
    ]);
  }

  const from = new Date(input.from);
  const to = new Date(input.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError('Invalid date range', HTTP_STATUS.BAD_REQUEST);
  }

  const fromDay = startOfUtcDay(from);
  const toExclusive = addUtcDays(startOfUtcDay(to), 1);

  if (toExclusive.getTime() <= fromDay.getTime()) {
    throw new AppError('to must be on or after from', HTTP_STATUS.BAD_REQUEST);
  }

  const maxMs = 366 * 24 * 60 * 60 * 1000;
  if (toExclusive.getTime() - fromDay.getTime() > maxMs) {
    throw new AppError('Date range cannot exceed 366 days', HTTP_STATUS.BAD_REQUEST);
  }

  return { from: fromDay, to: toExclusive };
}

export function mongoDateTruncUnit(granularity: AnalyticsGranularity): 'day' | 'week' | 'month' {
  return granularity;
}
