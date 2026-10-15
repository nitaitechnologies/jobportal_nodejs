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

export interface HiringPlanSeedDef extends PlanSeedDef {
  slug: string;
  catalog: 'hiring';
  hiringIntent: 'single' | 'multi';
  offerType: 'plan' | 'topup';
  monthlyPrice: number;
  upgradePrice: number | null;
  available: boolean;
  popular: boolean;
  badge: string;
  highlights: string[];
}

function padCount(value: number): string {
  return String(value).padStart(2, '0');
}

function planHighlights(input: {
  activeJobs: number;
  unlocks: number;
  boosts: number;
  days: number;
}): string[] {
  const jobWord = input.activeJobs === 1 ? 'job' : 'jobs';
  return [
    "High reach — more relevant calls & applies for 'Faster Hiring'",
    `Keep only ${padCount(input.activeJobs)} ${jobWord} active`,
    `Unlock ${input.unlocks.toLocaleString('en-IN')} candidates profiles from database`,
    `Boost jobs up to ${input.boosts} times`,
    'Post unlimited jobs and get unlimited responses',
    `Valid for ${input.days} days`,
    'Make job live & unlock candidates in one city',
  ];
}

function hiringPlan(input: {
  slug: string;
  name: string;
  hiringIntent: 'single' | 'multi';
  months: number;
  upfront: number;
  monthlyPrice: number;
  upgradePrice: number | null;
  available: boolean;
  popular?: boolean;
  activeJobs: number;
  unlocks: number;
  boosts: number;
  sortOrder: number;
}): HiringPlanSeedDef {
  const days = input.months * 30 === 360 ? 365 : input.months * 30;
  const billingCycle = input.months >= 12 ? 'yearly' : input.months >= 3 ? 'quarterly' : 'monthly';
  return {
    slug: input.slug,
    name: input.name,
    description:
      input.hiringIntent === 'single'
        ? 'Hiring for one role at a time.'
        : 'Hiring for multiple openings.',
    price: input.upfront,
    billingCycle,
    durationDays: days,
    sortOrder: input.sortOrder,
    catalog: 'hiring',
    hiringIntent: input.hiringIntent,
    offerType: 'plan',
    monthlyPrice: input.monthlyPrice,
    upgradePrice: input.upgradePrice,
    available: input.available,
    popular: Boolean(input.popular),
    badge: input.popular ? 'Most Popular' : '',
    highlights: planHighlights({
      activeJobs: input.activeJobs,
      unlocks: input.unlocks,
      boosts: input.boosts,
      days,
    }),
    features: {
      featuredJobs: input.boosts > 0,
      candidateContact: true,
      advancedCandidateSearch: true,
    },
    limits: {
      jobPostLimit: 9999,
      activeJobLimit: input.activeJobs,
      featuredJobLimit: input.boosts,
      jobListingLifetimeDays: days,
      contactUnlockLimit: input.unlocks,
      freeSearchResultLimit: 0,
    },
  };
}

function topUp(input: {
  slug: string;
  hiringIntent: 'single' | 'multi';
  price: number;
  jobPosts: number;
  unlocks: number;
  sortOrder: number;
}): HiringPlanSeedDef {
  return {
    slug: input.slug,
    name: 'Take a Top Up',
    description:
      input.hiringIntent === 'single'
        ? 'Add posts and unlocks for a single job.'
        : 'Add posts and unlocks across your openings.',
    price: input.price,
    billingCycle: 'monthly',
    durationDays: 30,
    sortOrder: input.sortOrder,
    catalog: 'hiring',
    hiringIntent: input.hiringIntent,
    offerType: 'topup',
    monthlyPrice: input.price,
    upgradePrice: null,
    available: true,
    popular: false,
    badge: '',
    highlights: ['Add more job posts', 'Unlock more candidates'],
    features: {
      featuredJobs: false,
      candidateContact: true,
      advancedCandidateSearch: true,
    },
    limits: {
      jobPostLimit: input.jobPosts,
      activeJobLimit: input.jobPosts,
      featuredJobLimit: 0,
      jobListingLifetimeDays: 30,
      contactUnlockLimit: input.unlocks,
      freeSearchResultLimit: 0,
    },
  };
}

/** Public pricing catalog. Multi prices are about 33% less than three single plans. */
export const HIRING_PLAN_DEFS: HiringPlanSeedDef[] = [
  hiringPlan({
    slug: 'single-1-month',
    name: '1 Month Plan',
    hiringIntent: 'single',
    months: 1,
    upfront: 2499,
    monthlyPrice: 2499,
    upgradePrice: null,
    available: false,
    activeJobs: 1,
    unlocks: 100,
    boosts: 3,
    sortOrder: 10,
  }),
  hiringPlan({
    slug: 'single-3-months',
    name: '3 Months Plan',
    hiringIntent: 'single',
    months: 3,
    upfront: 4999,
    monthlyPrice: 1666,
    upgradePrice: 2749,
    available: true,
    activeJobs: 1,
    unlocks: 300,
    boosts: 9,
    sortOrder: 11,
  }),
  hiringPlan({
    slug: 'single-1-year',
    name: '1 Year Plan',
    hiringIntent: 'single',
    months: 12,
    upfront: 11000,
    monthlyPrice: 916,
    upgradePrice: 8750,
    available: true,
    popular: true,
    activeJobs: 1,
    unlocks: 800,
    boosts: 24,
    sortOrder: 12,
  }),
  topUp({
    slug: 'single-top-up',
    hiringIntent: 'single',
    price: 1250,
    jobPosts: 1,
    unlocks: 25,
    sortOrder: 13,
  }),
  hiringPlan({
    slug: 'multi-1-month',
    name: '1 Month Plan',
    hiringIntent: 'multi',
    months: 1,
    upfront: 4999,
    monthlyPrice: 4999,
    upgradePrice: null,
    available: true,
    activeJobs: 3,
    unlocks: 300,
    boosts: 9,
    sortOrder: 20,
  }),
  hiringPlan({
    slug: 'multi-3-months',
    name: '3 Months Plan',
    hiringIntent: 'multi',
    months: 3,
    upfront: 9999,
    monthlyPrice: 3333,
    upgradePrice: 5499,
    available: true,
    activeJobs: 3,
    unlocks: 900,
    boosts: 27,
    sortOrder: 21,
  }),
  hiringPlan({
    slug: 'multi-1-year',
    name: '1 Year Plan',
    hiringIntent: 'multi',
    months: 12,
    upfront: 21999,
    monthlyPrice: 1833,
    upgradePrice: 17499,
    available: true,
    popular: true,
    activeJobs: 3,
    unlocks: 2400,
    boosts: 72,
    sortOrder: 22,
  }),
  topUp({
    slug: 'multi-top-up',
    hiringIntent: 'multi',
    price: 2499,
    jobPosts: 3,
    unlocks: 75,
    sortOrder: 23,
  }),
];

export function planSlug(name: string): string {
  return slugify(name);
}

export function allPlanSlugs(): string[] {
  return PLAN_DEFS.map((p) => planSlug(p.name));
}
