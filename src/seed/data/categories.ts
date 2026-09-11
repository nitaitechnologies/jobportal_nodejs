import { slugify } from '../../utils/slug';

export interface CategorySeedDef {
  name: string;
  description: string;
  children: string[];
}

export const CATEGORY_DEFS: CategorySeedDef[] = [
  {
    name: 'IT & Software',
    description: 'Software engineering, development, and IT operations roles.',
    children: [
      'Frontend Development',
      'Backend Development',
      'Full Stack Development',
      'Mobile Development',
      'DevOps & Cloud',
      'QA & Testing',
      'Data Engineering',
    ],
  },
  {
    name: 'Sales & Business Development',
    description: 'Sales, BD, and revenue growth roles.',
    children: ['Inside Sales', 'Field Sales', 'Business Development', 'Key Account Management'],
  },
  {
    name: 'Marketing & SEO',
    description: 'Digital marketing, SEO, content, and brand roles.',
    children: ['SEO', 'Digital Marketing', 'Content Marketing', 'Performance Marketing'],
  },
  {
    name: 'Finance & Accounting',
    description: 'Accounting, finance, audit, and tax roles.',
    children: ['Accounting', 'Financial Analysis', 'Taxation', 'Audit'],
  },
  {
    name: 'Human Resources',
    description: 'Recruiting, HR operations, and people roles.',
    children: ['Recruitment', 'HR Operations', 'Talent Acquisition'],
  },
  {
    name: 'Customer Support',
    description: 'Customer success, support, and service roles.',
    children: ['Voice Support', 'Technical Support', 'Customer Success'],
  },
  {
    name: 'Design & Creative',
    description: 'UI/UX, graphic design, and creative roles.',
    children: ['UI/UX Design', 'Graphic Design', 'Product Design'],
  },
  {
    name: 'Healthcare',
    description: 'Clinical, pharma, and healthcare operations roles.',
    children: ['Nursing', 'Medical Sales', 'Healthcare Administration'],
  },
  {
    name: 'Education',
    description: 'Teaching, training, and edtech roles.',
    children: ['Teaching', 'Corporate Training', 'Academic Counseling'],
  },
  {
    name: 'Engineering',
    description: 'Core engineering and manufacturing roles.',
    children: ['Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering'],
  },
  {
    name: 'Operations',
    description: 'Operations, supply chain, and process roles.',
    children: ['Operations Management', 'Process Improvement'],
  },
  {
    name: 'Legal',
    description: 'Legal counsel, compliance, and contract roles.',
    children: ['Corporate Legal', 'Compliance'],
  },
  {
    name: 'Hospitality',
    description: 'Hotels, F&B, and hospitality management.',
    children: ['Hotel Operations', 'Food & Beverage'],
  },
  {
    name: 'Retail',
    description: 'Store operations and retail sales roles.',
    children: ['Store Management', 'Retail Sales'],
  },
  {
    name: 'Logistics',
    description: 'Logistics, warehousing, and transportation.',
    children: ['Warehouse Operations', 'Fleet Management'],
  },
];

export function categorySlug(name: string): string {
  return slugify(name);
}

export function allCategorySlugs(): string[] {
  const slugs: string[] = [];
  for (const parent of CATEGORY_DEFS) {
    slugs.push(categorySlug(parent.name));
    for (const child of parent.children) {
      slugs.push(categorySlug(child));
    }
  }
  return slugs;
}
