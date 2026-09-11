import mongoose from 'mongoose';
import { Category } from '../models/Category';
import { Job } from '../models/Job';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import {
  mapAdminCategory,
  mapPublicCategorySummary,
  mapPublicCategoryWithChildren,
} from '../utils/categoryMapper';
import { createUniqueSlug, slugify } from '../utils/slug';
import type {
  AdminCategoryQuery,
  CategoryCreateInput,
  CategoryUpdateInput,
  PublicCategoryQuery,
} from '../validators/category.validator';

interface CategoryFilter {
  status?: 'active' | 'inactive';
  name?: { $regex: string; $options: string };
  slug?: string;
  parentId?: mongoose.Types.ObjectId | null | { $in: mongoose.Types.ObjectId[] };
  _id?: { $ne: mongoose.Types.ObjectId };
  $or?: Array<Record<string, unknown>>;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Live published (publicly visible) job counts for categories.
 * Parent categories include jobs on themselves plus active children.
 */
async function getPublishedJobCountsForCategories(
  categoryIds: mongoose.Types.ObjectId[],
  childrenByParent?: Map<string, mongoose.Types.ObjectId[]>,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (categoryIds.length === 0) {
    return counts;
  }

  const allIds = new Set(categoryIds.map((id) => id.toString()));
  if (childrenByParent) {
    for (const childIds of childrenByParent.values()) {
      for (const childId of childIds) {
        allIds.add(childId.toString());
      }
    }
  }

  const objectIds = Array.from(allIds).map((id) => new mongoose.Types.ObjectId(id));
  const now = new Date();

  const rows = await Job.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    {
      $match: {
        status: 'published',
        deletedAt: null,
        categoryId: { $in: objectIds },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      },
    },
    {
      $group: {
        _id: '$categoryId',
        count: { $sum: 1 },
      },
    },
  ]);

  const directCounts = new Map(
    rows.map((row) => [row._id.toString(), row.count] as const),
  );

  for (const categoryId of categoryIds) {
    const key = categoryId.toString();
    let total = directCounts.get(key) ?? 0;
    const childIds = childrenByParent?.get(key) ?? [];
    for (const childId of childIds) {
      total += directCounts.get(childId.toString()) ?? 0;
    }
    counts.set(key, total);
  }

  // Also expose direct counts for children when callers need them.
  for (const [key, value] of directCounts) {
    if (!counts.has(key)) {
      counts.set(key, value);
    }
  }

  return counts;
}

function parseParentFilter(parentId?: string): CategoryFilter {
  if (!parentId) {
    return {};
  }
  if (parentId === 'null' || parentId === 'root') {
    return { $or: [{ parentId: null }, { parentId: { $exists: false } }] };
  }
  return { parentId: new mongoose.Types.ObjectId(parentId) };
}

async function uniqueCategorySlug(nameOrSlug: string, excludeId?: string): Promise<string> {
  return createUniqueSlug(nameOrSlug, async (value) => {
    const query: CategoryFilter = { slug: value };
    if (excludeId) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }
    const existing = await Category.findOne(query).select('_id');
    return Boolean(existing);
  });
}

async function assertValidParent(parentId: string | null | undefined, selfId?: string): Promise<void> {
  if (parentId === null || parentId === undefined) {
    return;
  }

  if (selfId && parentId === selfId) {
    throw new AppError('A category cannot be its own parent', HTTP_STATUS.CONFLICT);
  }

  const parent = await Category.findById(parentId);
  if (!parent) {
    throw new AppError('Parent category not found', HTTP_STATUS.BAD_REQUEST);
  }

  if (parent.parentId) {
    throw new AppError(
      'Parent must be a root category. Only two hierarchy levels are supported',
      HTTP_STATUS.CONFLICT,
    );
  }

  if (selfId) {
    const self = await Category.findById(selfId).select('parentId');
    // Moving a root with children into another category would create 3 levels.
    if (self && !self.parentId) {
      const childCount = await Category.countDocuments({ parentId: self._id });
      if (childCount > 0) {
        throw new AppError(
          'Cannot nest a root category that already has subcategories',
          HTTP_STATUS.CONFLICT,
        );
      }
    }
  }
}

export class CategoryService {
  async listPublic(query: PublicCategoryQuery) {
    const filter: CategoryFilter = {
      status: 'active',
      ...parseParentFilter(query.parentId),
    };

    if (query.search) {
      filter.name = { $regex: escapeRegex(query.search), $options: 'i' };
    }

    const skip = (query.page - 1) * query.limit;

    // Flat search / filtered child listing
    if (query.search || query.parentId) {
      const [items, total] = await Promise.all([
        Category.find(filter).sort({ sortOrder: 1, name: 1 }).skip(skip).limit(query.limit),
        Category.countDocuments(filter),
      ]);

      // When listing children of a parent, do not roll up further; otherwise roll up for roots.
      const childrenByParent = new Map<string, mongoose.Types.ObjectId[]>();
      const needsRollup = !query.parentId;
      if (needsRollup && items.length > 0) {
        const rootIds = items.filter((item) => !item.parentId).map((item) => item._id);
        if (rootIds.length > 0) {
          const childRows = await Category.find({
            status: 'active',
            parentId: { $in: rootIds },
          }).select('_id parentId');
          for (const child of childRows) {
            const parentKey = child.parentId?.toString() ?? '';
            const list = childrenByParent.get(parentKey) ?? [];
            list.push(child._id);
            childrenByParent.set(parentKey, list);
          }
        }
      }

      const jobCounts = await getPublishedJobCountsForCategories(
        items.map((item) => item._id),
        childrenByParent.size > 0 ? childrenByParent : undefined,
      );

      return {
        categories: items.map((item) =>
          mapPublicCategorySummary(item, {
            jobCount: jobCounts.get(item._id.toString()) ?? 0,
          }),
        ),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit) || 1,
        },
      };
    }

    // Default homepage-style: active roots with active children
    const rootsFilter: CategoryFilter = {
      status: 'active',
      $or: [{ parentId: null }, { parentId: { $exists: false } }],
    };

    const [roots, total] = await Promise.all([
      Category.find(rootsFilter).sort({ sortOrder: 1, name: 1 }).skip(skip).limit(query.limit),
      Category.countDocuments(rootsFilter),
    ]);

    const rootIds = roots.map((root) => root._id);
    const children = await Category.find({
      status: 'active',
      parentId: { $in: rootIds },
    }).sort({ sortOrder: 1, name: 1 });

    const childrenByParent = new Map<string, typeof children>();
    const childIdsByParent = new Map<string, mongoose.Types.ObjectId[]>();
    for (const child of children) {
      const key = child.parentId?.toString() ?? '';
      const list = childrenByParent.get(key) ?? [];
      list.push(child);
      childrenByParent.set(key, list);

      const idList = childIdsByParent.get(key) ?? [];
      idList.push(child._id);
      childIdsByParent.set(key, idList);
    }

    const jobCounts = await getPublishedJobCountsForCategories(rootIds, childIdsByParent);

    return {
      categories: roots.map((root) =>
        mapPublicCategoryWithChildren(root, childrenByParent.get(root._id.toString()) ?? [], {
          jobCount: jobCounts.get(root._id.toString()) ?? 0,
          childJobCounts: jobCounts,
        }),
      ),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async getPublicBySlug(slug: string) {
    const category = await Category.findOne({
      slug: slug.trim().toLowerCase(),
      status: 'active',
    });

    if (!category) {
      throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND);
    }

    let parent = null;
    if (category.parentId) {
      parent = await Category.findOne({
        _id: category.parentId,
        status: 'active',
      }).select('name slug');
    }

    const children = await Category.find({
      parentId: category._id,
      status: 'active',
    }).sort({ sortOrder: 1, name: 1 });

    const childIdsByParent = new Map<string, mongoose.Types.ObjectId[]>();
    if (children.length > 0) {
      childIdsByParent.set(
        category._id.toString(),
        children.map((child) => child._id),
      );
    }

    const jobCounts = await getPublishedJobCountsForCategories(
      [category._id, ...children.map((child) => child._id)],
      childIdsByParent,
    );

    return {
      category: {
        ...mapPublicCategoryWithChildren(category, children, {
          jobCount: jobCounts.get(category._id.toString()) ?? 0,
          childJobCounts: jobCounts,
        }),
        parent: parent
          ? {
              id: parent._id.toString(),
              name: parent.name,
              slug: parent.slug,
            }
          : null,
      },
    };
  }

  async getPublicSubcategories(slug: string) {
    const parent = await Category.findOne({
      slug: slug.trim().toLowerCase(),
      status: 'active',
    });

    if (!parent) {
      throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND);
    }

    if (parent.parentId) {
      throw new AppError('Subcategories are only available for root categories', HTTP_STATUS.BAD_REQUEST);
    }

    const children = await Category.find({
      parentId: parent._id,
      status: 'active',
    }).sort({ sortOrder: 1, name: 1 });

    const childIdsByParent = new Map<string, mongoose.Types.ObjectId[]>([
      [parent._id.toString(), children.map((child) => child._id)],
    ]);
    const jobCounts = await getPublishedJobCountsForCategories(
      [parent._id, ...children.map((child) => child._id)],
      childIdsByParent,
    );

    return {
      parent: mapPublicCategorySummary(parent, {
        jobCount: jobCounts.get(parent._id.toString()) ?? 0,
      }),
      subcategories: children.map((child) =>
        mapPublicCategorySummary(child, {
          jobCount: jobCounts.get(child._id.toString()) ?? 0,
        }),
      ),
    };
  }

  async create(input: CategoryCreateInput) {
    await assertValidParent(input.parentId ?? null);

    const slugSource = input.slug?.trim() ? slugify(input.slug) : input.name;
    const slug = await uniqueCategorySlug(slugSource);

    const category = await Category.create({
      name: input.name,
      slug,
      description: input.description ?? '',
      icon: input.icon ?? '',
      image: input.image ?? '',
      parentId: input.parentId ? new mongoose.Types.ObjectId(input.parentId) : null,
      sortOrder: input.sortOrder ?? 0,
      status: input.status ?? 'active',
      jobCount: 0,
    });

    return { category: mapAdminCategory(category, { childCount: 0 }) };
  }

  async listAdmin(query: AdminCategoryQuery) {
    const filter: CategoryFilter = {
      ...parseParentFilter(query.parentId),
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      filter.name = { $regex: escapeRegex(query.search), $options: 'i' };
    }

    const sortDirection = query.sortOrder === 'desc' ? -1 : 1;
    const sort: Record<string, 1 | -1> =
      query.sortBy === 'name'
        ? { name: sortDirection }
        : query.sortBy === 'createdAt'
          ? { createdAt: sortDirection }
          : { sortOrder: sortDirection, name: 1 };

    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      Category.find(filter).sort(sort).skip(skip).limit(query.limit),
      Category.countDocuments(filter),
    ]);

    const parentIds = items
      .map((item) => item.parentId)
      .filter((id): id is NonNullable<typeof id> => Boolean(id));

    const parents = parentIds.length
      ? await Category.find({ _id: { $in: parentIds } }).select('name slug')
      : [];
    const parentMap = new Map(parents.map((parent) => [parent._id.toString(), parent]));

    const childCounts =
      items.length === 0
        ? []
        : await Category.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
            { $match: { parentId: { $in: items.map((item) => item._id) } } },
            { $group: { _id: '$parentId', count: { $sum: 1 } } },
          ]);
    const childCountMap = new Map(
      childCounts.map((row) => [row._id.toString(), row.count]),
    );

    return {
      categories: items.map((item) =>
        mapAdminCategory(item, {
          parent: item.parentId ? parentMap.get(item.parentId.toString()) ?? null : null,
          childCount: childCountMap.get(item._id.toString()) ?? 0,
        }),
      ),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async getAdminById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND);
    }

    const category = await Category.findById(id);
    if (!category) {
      throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND);
    }

    const [parent, childCount] = await Promise.all([
      category.parentId
        ? Category.findById(category.parentId).select('name slug')
        : Promise.resolve(null),
      Category.countDocuments({ parentId: category._id }),
    ]);

    return {
      category: mapAdminCategory(category, {
        parent,
        childCount,
      }),
    };
  }

  async update(id: string, input: CategoryUpdateInput) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND);
    }

    const category = await Category.findById(id);
    if (!category) {
      throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND);
    }

    if (input.parentId !== undefined) {
      await assertValidParent(input.parentId, id);
      category.parentId = input.parentId
        ? new mongoose.Types.ObjectId(input.parentId)
        : null;
    }

    if (input.name !== undefined) {
      category.name = input.name;
      // Slug stays stable for public URLs.
    }
    if (input.description !== undefined) {
      category.description = input.description;
    }
    if (input.icon !== undefined) {
      category.icon = input.icon;
    }
    if (input.image !== undefined) {
      category.image = input.image;
    }
    if (input.sortOrder !== undefined) {
      category.sortOrder = input.sortOrder;
    }
    if (input.status !== undefined) {
      category.status = input.status;
    }

    await category.save();

    const childCount = await Category.countDocuments({ parentId: category._id });
    const parent = category.parentId
      ? await Category.findById(category.parentId).select('name slug')
      : null;

    return {
      category: mapAdminCategory(category, { parent, childCount }),
    };
  }

  async remove(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND);
    }

    const category = await Category.findById(id);
    if (!category) {
      throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND);
    }

    const [childCount, jobCount] = await Promise.all([
      Category.countDocuments({ parentId: category._id }),
      Job.countDocuments({ categoryId: category._id }),
    ]);

    if (childCount > 0 || jobCount > 0) {
      category.status = 'inactive';
      await category.save();

      return {
        deleted: false,
        deactivated: true,
        id: category._id.toString(),
        status: category.status,
        reason: `Category has dependencies (${childCount} subcategories, ${jobCount} jobs) and was deactivated instead of deleted`,
      };
    }

    await Category.deleteOne({ _id: category._id });

    return {
      deleted: true,
      deactivated: false,
      id: category._id.toString(),
    };
  }
}

export const categoryService = new CategoryService();
