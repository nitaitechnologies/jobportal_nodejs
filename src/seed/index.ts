/**
 * WorkIndia demo data seeder entrypoint.
 *
 *   npm run seed
 *   npm run seed:reset
 *   npm run seed:verify
 *   npm run seed:reset && npm run seed
 *
 * Development / demo / staging only. Never runs on server start.
 */
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from '../config/database';
import { env } from '../config/env';
import {
  DEMO_EMAIL_DOMAIN,
  SEED_MODE,
  assertDemoPasswordPolicy,
  assertSeedEnvironmentAllowed,
} from './config';
import { createSeedContext } from './context';
import { listPrimaryDemoAccountEmails } from './data/personas';
import { SeedError, printSeedFailure, sanitizeSeedMessage } from './errors';
import { pruneSupersededDemoAccounts } from './helpers/pruneSuperseded';
import { resetDemoData } from './reset';
import { seedAdmins } from './seeders/admins.seeder';
import { seedAnalytics } from './seeders/analytics.seeder';
import { seedApplications } from './seeders/applications.seeder';
import { seedCareerAdvice } from './seeders/careerAdvice.seeder';
import { seedCandidates } from './seeders/candidates.seeder';
import { seedCategories } from './seeders/categories.seeder';
import { seedEmployersAndCompanies } from './seeders/employers.seeder';
import { seedInterviews } from './seeders/interviews.seeder';
import { seedJobs } from './seeders/jobs.seeder';
import { seedLocations } from './seeders/locations.seeder';
import { seedMediaAssets } from './seeders/media.seeder';
import { seedNotifications } from './seeders/notifications.seeder';
import { seedReports } from './seeders/reports.seeder';
import { seedSavedJobs } from './seeders/savedJobs.seeder';
import { seedSettings } from './seeders/settings.seeder';
import { seedSubscriptionPlans, seedSubscriptions } from './seeders/subscriptions.seeder';
import type { SeedSummary } from './types';
import { SeedValidationError, printIntegrityReport, validateSeed } from './validate';

function wantsResetBeforeSeed(): boolean {
  return process.argv.includes('--reset') || process.env.SEED_RESET === '1';
}

function isResetOnly(): boolean {
  return process.argv.includes('--reset-only') || process.env.SEED_COMMAND === 'reset';
}

async function runDomain(domain: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error: unknown) {
    if (error instanceof SeedError || error instanceof SeedValidationError) {
      throw error;
    }
    const reason = error instanceof Error ? error.message : 'Unknown error';
    throw new SeedError('seed_data', domain, sanitizeSeedMessage(reason));
  }
}

function printBanner(): void {
  console.log('');
  console.log('WorkIndia Demo Seed');
  console.log('');
  console.log(`Environment: ${env.nodeEnv}`);
  console.log(`Mode: ${SEED_MODE}`);
  console.log('');
}

function printSummary(summary: SeedSummary, integrityOk: boolean, elapsedMs: number): void {
  console.log(`Categories: ${summary.categories}`);
  console.log(`Locations: ${summary.locations}`);
  console.log(`Candidates: ${summary.candidates}`);
  console.log(`Employers: ${summary.employers}`);
  console.log(`Companies: ${summary.companies}`);
  console.log(`Jobs: ${summary.jobs}`);
  console.log(`Applications: ${summary.applications}`);
  console.log(`Interviews: ${summary.interviews}`);
  console.log(`Notifications: ${summary.notifications}`);
  console.log(`Career Articles: ${summary.careerArticles}`);
  console.log(`Reports: ${summary.reports}`);
  console.log(`Plans: ${summary.plans}`);
  console.log(`Subscriptions: ${summary.subscriptions}`);
  console.log(`Analytics Events: ${summary.analyticsEvents}`);
  console.log(`Media: ${summary.mediaFiles}`);
  console.log(`Saved Jobs: ${summary.savedJobs}`);
  console.log(`Admins: ${summary.admins}`);
  console.log('');
  console.log(`Integrity checks: ${integrityOk ? 'PASS' : 'FAIL'}`);
  console.log(`Seed status: ${integrityOk ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Duration: ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log('');
  console.log('Demo accounts (password via SEED_DEMO_PASSWORD / docs — never printed):');
  for (const account of listPrimaryDemoAccountEmails()) {
    console.log(`  ${account.label}: ${account.email}`);
  }
  console.log(`  Domain: @${DEMO_EMAIL_DOMAIN}`);
  console.log('');
}

async function connectOrThrow(): Promise<void> {
  try {
    await connectDatabase();
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : 'Unknown connection error';
    throw new SeedError('database', 'MongoDB', sanitizeSeedMessage(reason));
  }
  if (!isDatabaseConnected()) {
    throw new SeedError('database', 'MongoDB', 'MongoDB connection validation failed');
  }
}

async function runSeed(): Promise<void> {
  assertSeedEnvironmentAllowed(env.nodeEnv, {
    destructive: wantsResetBeforeSeed(),
  });
  assertDemoPasswordPolicy();

  printBanner();
  const started = Date.now();
  await connectOrThrow();

  if (wantsResetBeforeSeed()) {
    console.log('Resetting identifiable demo data...');
    const resetCounts = await resetDemoData();
    console.log('Reset removed demo documents:', Object.keys(resetCounts).length, 'collections');
    console.log('');
  } else {
    const pruned = await pruneSupersededDemoAccounts();
    if (pruned > 0) {
      console.log(`Pruned ${pruned} superseded demo account(s)`);
      console.log('');
    }
  }

  const ctx = createSeedContext();

  await runDomain('Categories', () => seedCategories(ctx));
  await runDomain('Locations', () => seedLocations(ctx));
  await runDomain('Admins', () => seedAdmins(ctx));
  await runDomain('Candidates', () => seedCandidates(ctx));
  await runDomain('Employers', () => seedEmployersAndCompanies(ctx));
  await runDomain('Jobs', () => seedJobs(ctx));
  await runDomain('Saved Jobs', () => seedSavedJobs(ctx));
  await runDomain('Applications', () => seedApplications(ctx));
  await runDomain('Interviews', () => seedInterviews(ctx));
  await runDomain('Notifications', () => seedNotifications(ctx));
  await runDomain('Career Articles', () => seedCareerAdvice(ctx));
  await runDomain('Media', () => seedMediaAssets(ctx));
  await runDomain('Reports', () => seedReports(ctx));
  await runDomain('Plans', () => seedSubscriptionPlans(ctx));
  await runDomain('Subscriptions', () => seedSubscriptions(ctx));
  await runDomain('Settings', () => seedSettings(ctx));
  await runDomain('Analytics', () => seedAnalytics(ctx));

  let report;
  try {
    report = await validateSeed(ctx);
  } catch (error: unknown) {
    if (error instanceof SeedValidationError) {
      throw new SeedError('integrity', error.domain, error.message);
    }
    throw error;
  }
  printIntegrityReport(report);

  if (!report.ok) {
    printSummary(ctx.summary, false, Date.now() - started);
    throw new SeedError(
      'integrity',
      'Validation',
      report.failures[0] ?? 'One or more integrity checks failed',
    );
  }

  printSummary(ctx.summary, true, Date.now() - started);
}

async function runResetOnly(): Promise<void> {
  assertSeedEnvironmentAllowed(env.nodeEnv, { destructive: true });
  printBanner();
  console.log('Command: reset (demo documents only)');
  console.log('');
  await connectOrThrow();
  const counts = await resetDemoData();
  console.log('WorkIndia Demo Reset');
  console.log('');
  for (const [key, value] of Object.entries(counts)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('');
  console.log('Reset status: SUCCESS');
  console.log('');
}

async function main(): Promise<void> {
  if (isResetOnly()) {
    await runResetOnly();
  } else {
    await runSeed();
  }
}

main()
  .then(() => {
    process.exitCode = process.exitCode ?? 0;
  })
  .catch((error: unknown) => {
    if (error instanceof SeedValidationError) {
      printSeedFailure(new SeedError('integrity', error.domain, error.message));
    } else {
      printSeedFailure(error);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase().catch(() => undefined);
    process.exit(process.exitCode ?? 0);
  });
