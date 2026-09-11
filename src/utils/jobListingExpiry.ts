const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Resolve listing expiry for a published job.
 * When `jobListingLifetimeDays` is set (e.g. Free = 10), clamp to publish + lifetime.
 * Always respect an earlier application deadline when present.
 */
export function resolveJobExpiresAt(options: {
  publishedAt: Date;
  applicationDeadline?: Date | null;
  jobListingLifetimeDays?: number | null;
}): Date | undefined {
  const { publishedAt, applicationDeadline, jobListingLifetimeDays } = options;
  const candidates: Date[] = [];

  if (applicationDeadline) {
    candidates.push(applicationDeadline);
  }

  const lifetime =
    typeof jobListingLifetimeDays === 'number' &&
    Number.isFinite(jobListingLifetimeDays) &&
    jobListingLifetimeDays > 0
      ? Math.floor(jobListingLifetimeDays)
      : null;

  if (lifetime) {
    candidates.push(new Date(publishedAt.getTime() + lifetime * MS_PER_DAY));
  }

  if (candidates.length === 0) {
    return undefined;
  }

  return candidates.reduce((earliest, date) =>
    date.getTime() < earliest.getTime() ? date : earliest,
  );
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + Math.max(0, days) * MS_PER_DAY);
}
