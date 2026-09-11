import { slugify } from '../../utils/slug';

export interface ArticleSeedDef {
  title: string;
  category: string;
  tags: string[];
  excerpt: string;
  status: 'draft' | 'published' | 'archived';
}

export const ARTICLE_DEFS: ArticleSeedDef[] = [
  {
    title: 'How to Write a Resume That Gets Shortlisted',
    category: 'Resume',
    tags: ['resume', 'job-search'],
    excerpt: 'Practical resume structure tips for Indian job portals and ATS screening.',
    status: 'published',
  },
  {
    title: 'Interview Preparation Checklist for Freshers',
    category: 'Interviews',
    tags: ['interview', 'freshers'],
    excerpt: 'A calm, step-by-step checklist before your first technical or HR round.',
    status: 'published',
  },
  {
    title: 'Job Search Strategy When Switching Domains',
    category: 'Career Change',
    tags: ['career-change', 'strategy'],
    excerpt: 'How to reframe transferable skills when moving into a new industry.',
    status: 'published',
  },
  {
    title: 'Salary Negotiation Without Burning Bridges',
    category: 'Compensation',
    tags: ['salary', 'negotiation'],
    excerpt: 'Polite scripts and research habits for negotiating offers in India.',
    status: 'published',
  },
  {
    title: 'Making Remote Work Actually Work',
    category: 'Remote Work',
    tags: ['remote', 'productivity'],
    excerpt: 'Boundaries, tooling, and communication habits for hybrid and remote roles.',
    status: 'published',
  },
  {
    title: 'Optimise Your LinkedIn Profile for Recruiters',
    category: 'Personal Branding',
    tags: ['linkedin', 'branding'],
    excerpt: 'Headline, about section, and activity tips that attract inbound opportunities.',
    status: 'published',
  },
  {
    title: 'Landing Your First Job After Graduation',
    category: 'Freshers',
    tags: ['freshers', 'first-job'],
    excerpt: 'Where to apply, what to practise, and how to stay consistent for 90 days.',
    status: 'published',
  },
  {
    title: 'Cracking the Technical Interview Round',
    category: 'Interviews',
    tags: ['technical-interview', 'coding'],
    excerpt: 'Problem-solving frameworks, communication tips, and common pitfalls.',
    status: 'published',
  },
  {
    title: 'Career Growth Beyond Promotions',
    category: 'Growth',
    tags: ['growth', 'skills'],
    excerpt: 'Build leverage through skills, visibility, and stretch projects.',
    status: 'published',
  },
  {
    title: 'Freelancing While Employed: What to Check',
    category: 'Freelancing',
    tags: ['freelance', 'side-projects'],
    excerpt: 'Contracts, conflicts of interest, and time management basics.',
    status: 'published',
  },
  {
    title: 'Workplace Communication That Builds Trust',
    category: 'Soft Skills',
    tags: ['communication', 'workplace'],
    excerpt: 'Async updates, meeting hygiene, and feedback that lands well.',
    status: 'published',
  },
  {
    title: 'How Hiring Managers Read Applications',
    category: 'Applications',
    tags: ['applications', 'hiring'],
    excerpt: 'What stands out in cover letters and profiles on job marketplaces.',
    status: 'published',
  },
  {
    title: 'Building a Portfolio With Small Projects',
    category: 'Portfolio',
    tags: ['portfolio', 'projects'],
    excerpt: 'Show outcomes, not just screenshots — examples for designers and developers.',
    status: 'published',
  },
  {
    title: 'Notice Period Etiquette for Job Switchers',
    category: 'Job Switch',
    tags: ['notice-period', 'ethics'],
    excerpt: 'How to resign professionally and plan overlapping interviews.',
    status: 'published',
  },
  {
    title: 'Choosing Between Startup and Enterprise Roles',
    category: 'Career Choice',
    tags: ['startup', 'enterprise'],
    excerpt: 'Trade-offs in learning velocity, stability, compensation, and ownership.',
    status: 'published',
  },
  {
    title: 'Upskilling Paths for Mid-Level Professionals',
    category: 'Learning',
    tags: ['upskilling', 'mid-level'],
    excerpt: 'Prioritise skills that compound across roles in the next two years.',
    status: 'published',
  },
  {
    title: 'Handling Rejection After Multiple Interviews',
    category: 'Mindset',
    tags: ['rejection', 'mindset'],
    excerpt: 'Recover faster with structured retros and healthier search routines.',
    status: 'published',
  },
  {
    title: 'Draft: Upcoming Guide to Campus Placements',
    category: 'Freshers',
    tags: ['campus', 'draft'],
    excerpt: 'Internal draft for the campus placement guide.',
    status: 'draft',
  },
  {
    title: 'Archived: Old SEO Tips From 2019',
    category: 'SEO',
    tags: ['seo', 'archived'],
    excerpt: 'Legacy article retained for archive status demo.',
    status: 'archived',
  },
  {
    title: 'Preparing for HR Screening Calls',
    category: 'Interviews',
    tags: ['hr', 'screening'],
    excerpt: 'Common questions, salary bands, and how to set expectations early.',
    status: 'published',
  },
];

export function articleSlug(title: string): string {
  return slugify(title);
}

export function allArticleSlugs(): string[] {
  return ARTICLE_DEFS.map((a) => articleSlug(a.title));
}

export function articleBody(title: string, excerpt: string): string {
  const sections = [
    `# ${title}`,
    '',
    excerpt,
    '',
    '## Why this matters',
    '',
    'Job seekers in India often compete across portals, referrals, and campus pipelines.',
    'A clear strategy beats spraying applications. Use this guide as a practical checklist',
    'you can revisit weekly while you search.',
    '',
    '## Action checklist',
    '',
    '1. Clarify your target role, city preference, and salary band before applying.',
    '2. Keep resume, LinkedIn, and WorkIndia profile language consistent.',
    '3. Practise a 60-second story about your most recent impactful project.',
    '4. Track every application with date, status, and follow-up reminder.',
    '5. After each interview, write three notes: what went well, what to improve, next step.',
    '',
    '## Common mistakes',
    '',
    '- Sending the same generic cover letter to every employer.',
    '- Listing tools without outcomes (prefer metrics and ownership).',
    '- Ignoring notice-period and joining constraints until the offer stage.',
    '- Stopping applications after two rejections instead of iterating.',
    '',
    '## Closing note',
    '',
    'Treat your job search like a product: ship weekly improvements based on response rates.',
    'Small, consistent upgrades to your profile and interview practice compound quickly.',
  ];
  return sections.join('\n');
}
