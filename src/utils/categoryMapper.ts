import type { Types } from 'mongoose';

export interface CategoryLike {
  _id: Types.ObjectId | { toString(): string };
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  image?: string | null;
  parentId?: Types.ObjectId | null;
  status?: string;
  sortOrder?: number | null;
  jobCount?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export function mapPublicCategorySummary(
  category: CategoryLike,
  extras?: { jobCount?: number },
) {
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    description: category.description ?? '',
    icon: category.icon ?? '',
    image: category.image ?? '',
    parentId: category.parentId ? category.parentId.toString() : null,
    sortOrder: category.sortOrder ?? 0,
    jobCount: extras?.jobCount ?? category.jobCount ?? 0,
  };
}

export function mapPublicCategoryWithChildren(
  category: CategoryLike,
  children: CategoryLike[] = [],
  extras?: {
    jobCount?: number;
    childJobCounts?: Map<string, number>;
  },
) {
  return {
    ...mapPublicCategorySummary(category, { jobCount: extras?.jobCount }),
    children: children
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((child) =>
        mapPublicCategorySummary(child, {
          jobCount: extras?.childJobCounts?.get(child._id.toString()),
        }),
      ),
  };
}

export function mapAdminCategory(
  category: CategoryLike,
  extras?: {
    parent?: CategoryLike | null;
    childCount?: number;
  },
) {
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    description: category.description ?? '',
    icon: category.icon ?? '',
    image: category.image ?? '',
    parentId: category.parentId ? category.parentId.toString() : null,
    parent: extras?.parent
      ? {
          id: extras.parent._id.toString(),
          name: extras.parent.name,
          slug: extras.parent.slug,
        }
      : null,
    status: category.status,
    sortOrder: category.sortOrder ?? 0,
    jobCount: category.jobCount ?? 0,
    childCount: extras?.childCount ?? 0,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}
