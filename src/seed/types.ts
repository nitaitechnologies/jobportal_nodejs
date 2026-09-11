import type { Types } from 'mongoose';
import type { AdminRole, BillingCycle } from '../constants/enums';

export interface SeedLocationNode {
  id: Types.ObjectId;
  name: string;
  slug: string;
  type: 'country' | 'state' | 'city' | 'area';
  parentId: Types.ObjectId | null;
  countryCode?: string;
  stateCode?: string;
  cityName?: string;
  stateName?: string;
  countryName?: string;
  displayName?: string;
}

export interface SeedCategoryNode {
  id: Types.ObjectId;
  name: string;
  slug: string;
  parentId: Types.ObjectId | null;
}

export interface SeedUserRef {
  userId: Types.ObjectId;
  email: string;
  name: string;
  role: 'candidate' | 'employer' | 'admin';
}

export interface SeedAdminRef extends SeedUserRef {
  adminUserId: Types.ObjectId;
  adminRole: AdminRole;
}

export interface SeedCandidateRef extends SeedUserRef {
  candidateId: Types.ObjectId;
  profileCompletion: number;
  personaKey?: string;
}

export interface SeedEmployerRef extends SeedUserRef {
  employerId: Types.ObjectId;
  companyId: Types.ObjectId;
  companySlug: string;
  companyName: string;
  personaKey?: string;
  jobMode?: 'busy' | 'drafts' | 'featured' | 'normal' | 'quiet';
}

export interface SeedJobRef {
  jobId: Types.ObjectId;
  slug: string;
  title: string;
  status: string;
  companyId: Types.ObjectId;
  employerId: Types.ObjectId;
  categoryId?: Types.ObjectId;
}

export interface SeedApplicationRef {
  applicationId: Types.ObjectId;
  candidateId: Types.ObjectId;
  jobId: Types.ObjectId;
  employerId: Types.ObjectId;
  companyId: Types.ObjectId;
  status: string;
  candidateUserId: Types.ObjectId;
  employerUserId: Types.ObjectId;
}

export interface SeedPlanRef {
  planId: Types.ObjectId;
  slug: string;
  name: string;
  price: number;
  billingCycle: BillingCycle;
  durationDays: number;
  features: Record<string, unknown>;
  limits: Record<string, number>;
}

export interface SeedSummary {
  categories: number;
  locations: number;
  admins: number;
  candidates: number;
  employers: number;
  companies: number;
  jobs: number;
  savedJobs: number;
  applications: number;
  interviews: number;
  notifications: number;
  careerArticles: number;
  reports: number;
  plans: number;
  subscriptions: number;
  analyticsEvents: number;
  mediaFiles: number;
}

export interface SeedContext {
  locations: SeedLocationNode[];
  cities: SeedLocationNode[];
  areas: SeedLocationNode[];
  categories: SeedCategoryNode[];
  parentCategories: SeedCategoryNode[];
  subcategories: SeedCategoryNode[];
  admins: SeedAdminRef[];
  candidates: SeedCandidateRef[];
  employers: SeedEmployerRef[];
  jobs: SeedJobRef[];
  publishedJobs: SeedJobRef[];
  applications: SeedApplicationRef[];
  plans: SeedPlanRef[];
  summary: SeedSummary;
}
