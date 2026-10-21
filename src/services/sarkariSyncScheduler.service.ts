import { env } from '../config/env';
import { sarkariJobService } from './sarkariJob.service';

let started = false;

async function runSync(reason: string): Promise<void> {
  if (!env.sarkariSyncEnabled) {
    console.log(`[sarkari] sync skipped (${reason}) — SARKARI_SYNC_ENABLED is off`);
    return;
  }
  try {
    console.log(`[sarkari] sync starting (${reason})…`);
    const result = await sarkariJobService.syncFromSource();
    console.log(`[sarkari] sync done (${reason}): upserted=${result.upserted} scraped=${result.total}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`[sarkari] sync failed (${reason}):`, message);
  }
}

/** Kick off an initial sync (if DB empty or always) and optional interval refreshes. */
export function startSarkariSyncScheduler(): void {
  if (started) return;
  started = true;

  void (async () => {
    try {
      const count = await sarkariJobService.countActive();
      // Always refresh on boot so candidates see fresh data; upserts prevent duplicates.
      await runSync(count === 0 ? 'startup-empty' : 'startup-refresh');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error('[sarkari] startup sync error:', message);
    }
  })();

  if (env.sarkariSyncIntervalMinutes > 0) {
    const ms = env.sarkariSyncIntervalMinutes * 60_000;
    const timer = setInterval(() => {
      void runSync('interval');
    }, ms);
    if (typeof timer.unref === 'function') timer.unref();
    console.log(`[sarkari] scheduler every ${env.sarkariSyncIntervalMinutes} min`);
  }
}
