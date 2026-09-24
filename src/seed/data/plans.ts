import type { BillingCycle } from '../../constants/enums';
import { slugify } from '../../utils/slug';

export interface PlanSeedDef {
  name: string;
  description: string;
  price: number;
  billingCycle: BillingCycle;
  durationDays: number;
  sortOrder: number;
  features: {
    featuredJobs: boolean;
    candidateContact: boolean;
    advancedCandidateSearch: boolean;
  };
  limits: {
    jobPostLimit: number;
    activeJobLimit: number;
    featuredJobLimit: number;
    jobListingLifetimeDays: number;
    contactUnlockLimit: number;
    freeSearchResultLimit: number;
  };
}

export const PLAN_DEFS: PlanSeedDef[] = [
  {
    name: 'Free',
    description: 'Get started with limited job posts for small teams. Free listings expire after 10 days.',
    price: 0,
    billingCycle: 'monthly',
    durationDays: 30,
    sortOrder: 1,
    features: { featuredJobs: false, candidateContact: false, advancedCandidateSearch: false },
    limits: {
      jobPostLimit: 3,
      activeJobLimit: 2,
      featuredJobLimit: 0,
      jobListingLifetimeDays: 10,
      contactUnlockLimit: 0,
      freeSearchResultLimit: 25,
    },
  },
  {
    name: 'Starter',
    description: 'For growing employers who need more active listings.',
    price: 1999,
    billingCycle: 'monthly',
    durationDays: 30,
    sortOrder: 2,
    features: { featuredJobs: false, candidateContact: true, advancedCandidateSearch: true },
    limits: {
      jobPostLimit: 15,
      activeJobLimit: 10,
      featuredJobLimit: 1,
      jobListingLifetimeDays: 30,
      contactUnlockLimit: 20,
      freeSearchResultLimit: 0,
    },
  },
  {
    name: 'Professional',
    description: 'Higher limits plus featured jobs for serious hiring pipelines.',
    price: 4999,
    billingCycle: 'monthly',
    durationDays: 30,
    sortOrder: 3,
    features: { featuredJobs: true, candidateContact: true, advancedCandidateSearch: true },
    limits: {
      jobPostLimit: 50,
      activeJobLimit: 30,
      featuredJobLimit: 5,
      jobListingLifetimeDays: 45,
      contactUnlockLimit: 100,
      freeSearchResultLimit: 0,
    },
  },
  {
    name: 'Business',
    description: 'Annual plan for multi-location hiring teams.',
    price: 49999,
    billingCycle: 'yearly',
    durationDays: 365,
    sortOrder: 4,
    features: { featuredJobs: true, candidateContact: true, advancedCandidateSearch: true },
    limits: {
      jobPostLimit: 200,
      activeJobLimit: 100,
      featuredJobLimit: 20,
      jobListingLifetimeDays: 60,
      contactUnlockLimit: 500,
      freeSearchResultLimit: 0,
    },
  },
];

export function planSlug(name: string): string {
  return slugify(name);
}

export function allPlanSlugs(): string[] {
  return PLAN_DEFS.map((p) => planSlug(p.name));
}
