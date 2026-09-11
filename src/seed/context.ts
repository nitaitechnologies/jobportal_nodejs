import type { SeedContext, SeedSummary } from './types';

export function createEmptySummary(): SeedSummary {
  return {
    categories: 0,
    locations: 0,
    admins: 0,
    candidates: 0,
    employers: 0,
    companies: 0,
    jobs: 0,
    savedJobs: 0,
    applications: 0,
    interviews: 0,
    notifications: 0,
    careerArticles: 0,
    reports: 0,
    plans: 0,
    subscriptions: 0,
    analyticsEvents: 0,
    mediaFiles: 0,
  };
}

export function createSeedContext(): SeedContext {
  return {
    locations: [],
    cities: [],
    areas: [],
    categories: [],
    parentCategories: [],
    subcategories: [],
    admins: [],
    candidates: [],
    employers: [],
    jobs: [],
    publishedJobs: [],
    applications: [],
    plans: [],
    summary: createEmptySummary(),
  };
}
