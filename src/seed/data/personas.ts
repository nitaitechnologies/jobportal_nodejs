import type { AdminRole } from '../../constants/enums';
import { demoEmail } from '../config';

/**
 * Stable demo personas for end-to-end walkthroughs (Candidate / Employer / Admin UIs).
 * Single source of truth for demo emails — do not duplicate credentials elsewhere.
 * Emails use @workindia.demo for reset safety. Password is SEED_DEMO_PASSWORD only.
 */
export const DEMO_ADMIN_ACCOUNTS: ReadonlyArray<{
  local: string;
  name: string;
  role: AdminRole;
  label: string;
}> = [
  { local: 'superadmin', name: 'Demo Super Admin', role: 'super_admin', label: 'Super admin' },
  { local: 'admin', name: 'Demo Platform Admin', role: 'admin', label: 'Admin' },
  { local: 'moderator', name: 'Demo Moderator', role: 'moderator', label: 'Moderator' },
  { local: 'support', name: 'Demo Support Agent', role: 'support', label: 'Support' },
  { local: 'admin.ops', name: 'Demo Ops Admin', role: 'admin', label: 'Ops admin' },
];

export const DEMO_PERSONAS = {
  candidateComplete: {
    key: 'candidate-complete',
    emailLocal: 'candidate.complete',
    name: 'Ananya Complete',
    tier: 100 as const,
    savedTarget: 9,
    applicationTarget: 12,
    wantInterview: true,
  },
  candidateIncomplete: {
    key: 'candidate-incomplete',
    emailLocal: 'candidate.incomplete',
    name: 'Dev Incomplete',
    tier: 20 as const,
    savedTarget: 0,
    applicationTarget: 0,
    wantInterview: false,
  },
  candidateActive: {
    key: 'candidate-active',
    emailLocal: 'candidate.active',
    name: 'Kabir Active',
    tier: 100 as const,
    savedTarget: 7,
    applicationTarget: 15,
    wantInterview: true,
  },
  employerActive: {
    key: 'employer-active',
    emailLocal: 'employer.active',
    /** Maps to company index 0 (Nimbus Softworks) */
    companyIndex: 0,
    jobMode: 'busy' as const,
  },
  employerNew: {
    key: 'employer-new',
    emailLocal: 'employer.new',
    companyIndex: 1,
    jobMode: 'drafts' as const,
  },
  employerPaid: {
    key: 'employer-paid',
    emailLocal: 'employer.paid',
    companyIndex: 2,
    jobMode: 'featured' as const,
  },
} as const;

export function personaEmail(local: string): string {
  return demoEmail(local);
}

/** Stable walkthrough emails shown in seed summary (no passwords). */
export function listPrimaryDemoAccountEmails(): Array<{ label: string; email: string }> {
  return [
    { label: 'Super admin', email: demoEmail('superadmin') },
    { label: 'Admin', email: demoEmail('admin') },
    { label: 'Moderator', email: demoEmail('moderator') },
    { label: 'Support', email: demoEmail('support') },
    {
      label: 'Candidate (complete)',
      email: demoEmail(DEMO_PERSONAS.candidateComplete.emailLocal),
    },
    {
      label: 'Candidate (incomplete)',
      email: demoEmail(DEMO_PERSONAS.candidateIncomplete.emailLocal),
    },
    {
      label: 'Candidate (active)',
      email: demoEmail(DEMO_PERSONAS.candidateActive.emailLocal),
    },
    {
      label: 'Employer (active)',
      email: demoEmail(DEMO_PERSONAS.employerActive.emailLocal),
    },
    {
      label: 'Employer (new/drafts)',
      email: demoEmail(DEMO_PERSONAS.employerNew.emailLocal),
    },
    {
      label: 'Employer (paid)',
      email: demoEmail(DEMO_PERSONAS.employerPaid.emailLocal),
    },
  ];
}

/** Prefer major Indian metros for job location distribution. */
export const PRIORITY_CITY_NAMES = [
  'Delhi',
  'Gurugram',
  'Noida',
  'Mumbai',
  'Bengaluru',
  'Hyderabad',
  'Pune',
  'Chennai',
  'Kolkata',
  'Jaipur',
  'Ahmedabad',
  'Lucknow',
  'Indore',
  'Chandigarh',
] as const;

/** Job title → subcategory slug for realistic category assignment. */
export const TITLE_TO_CATEGORY_SLUG: Record<string, string> = {
  'Frontend Developer': 'frontend-development',
  'React Developer': 'frontend-development',
  'Backend Developer': 'backend-development',
  'Laravel Developer': 'backend-development',
  'Node.js Developer': 'backend-development',
  'Flutter Developer': 'mobile-development',
  'DevOps Engineer': 'devops-cloud',
  'QA Engineer': 'qa-testing',
  'Data Analyst': 'data-engineering',
  'UI/UX Designer': 'ui-ux-design',
  'Product Designer': 'product-design',
  'Graphic Designer': 'graphic-design',
  'SEO Executive': 'seo',
  'Digital Marketing Manager': 'digital-marketing',
  'Content Writer': 'content-marketing',
  'Sales Executive': 'inside-sales',
  'Inside Sales Associate': 'inside-sales',
  'Business Development Manager': 'business-development',
  'HR Recruiter': 'recruitment',
  Accountant: 'accounting',
  'Customer Support Executive': 'voice-support',
  'Technical Support Engineer': 'technical-support',
  'Warehouse Supervisor': 'warehouse-operations',
  'Store Manager': 'store-management',
  'Nursing Staff': 'nursing',
  'Corporate Trainer': 'corporate-training',
};

export type ExperienceBand = 'fresher' | '0-1' | '1-3' | '3-5' | '5-8' | '8+';

export const EXPERIENCE_BANDS: Array<{
  band: ExperienceBand;
  min: number;
  max: number;
  /** Monthly INR salary range */
  salaryMin: [number, number];
  salaryMaxExtra: [number, number];
}> = [
  { band: 'fresher', min: 0, max: 0, salaryMin: [18000, 28000], salaryMaxExtra: [4000, 12000] },
  { band: '0-1', min: 0, max: 1, salaryMin: [20000, 35000], salaryMaxExtra: [5000, 15000] },
  { band: '1-3', min: 1, max: 3, salaryMin: [35000, 55000], salaryMaxExtra: [8000, 25000] },
  { band: '3-5', min: 3, max: 5, salaryMin: [50000, 85000], salaryMaxExtra: [10000, 35000] },
  { band: '5-8', min: 5, max: 8, salaryMin: [80000, 140000], salaryMaxExtra: [15000, 50000] },
  { band: '8+', min: 8, max: 12, salaryMin: [120000, 200000], salaryMaxExtra: [20000, 80000] },
];
