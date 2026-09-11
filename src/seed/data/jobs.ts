export const JOB_TITLE_POOL = [
  'Frontend Developer',
  'Backend Developer',
  'Laravel Developer',
  'Flutter Developer',
  'React Developer',
  'Node.js Developer',
  'UI/UX Designer',
  'SEO Executive',
  'Digital Marketing Manager',
  'Sales Executive',
  'HR Recruiter',
  'Accountant',
  'Customer Support Executive',
  'Data Analyst',
  'Business Development Manager',
  'DevOps Engineer',
  'QA Engineer',
  'Content Writer',
  'Graphic Designer',
  'Product Designer',
  'Inside Sales Associate',
  'Technical Support Engineer',
  'Warehouse Supervisor',
  'Store Manager',
  'Nursing Staff',
  'Corporate Trainer',
] as const;

export const BENEFITS_POOL = [
  'Health insurance',
  'Flexible hours',
  'Remote work stipend',
  'Learning budget',
  'PF & gratuity',
  'Performance bonus',
  'Meal vouchers',
  'Cab facility',
  'Work from home (hybrid)',
  'Annual leave',
] as const;

export function jobDescription(title: string, companyName: string): string {
  return [
    `${companyName} is hiring a ${title} to join our growing team.`,
    '',
    'You will collaborate with cross-functional stakeholders, ship high-quality work,',
    'and help us deliver reliable outcomes for customers across India.',
    '',
    'We value clear communication, ownership, and a practical approach to problem-solving.',
    'This role offers room to grow with mentorship and measurable impact.',
  ].join('\n');
}

export const RESPONSIBILITIES = [
  'Own day-to-day delivery for assigned projects',
  'Collaborate with product, design, and engineering partners',
  'Document processes and share knowledge with the team',
  'Track metrics and continuously improve outcomes',
  'Participate in planning and retrospectives',
] as const;

export const REQUIREMENTS = [
  'Relevant experience for the role level',
  'Strong written and verbal communication in English',
  'Ability to work independently and in a team',
  'Familiarity with modern tools used in the domain',
  'Willingness to learn and adapt quickly',
] as const;
