import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { Category } from '../models/Category';
import { RoleAd } from '../models/RoleAd';
import { RoleAdClick } from '../models/RoleAdClick';
import type { AuthenticatedCandidate } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { skillMatchesRole } from '../utils/roleAdMatch';
import type {
  RoleAdClickQuery,
  RoleAdCreateInput,
  RoleAdQuery,
  RoleAdUpdateInput,
} from '../validators/roleAd.validator';

type CategorySummary = { id: string; name: string; slug: string };

export type PublicRoleAd = {
  id: string;
  companyName: string;
  description: string;
  bannerUrl: string;
  mobileBannerUrl: string;
  linkUrl: string;
  type: string;
  fromDate: Date;
  toDate: Date;
  categories: CategorySummary[];
  matchedSkills: string[];
};

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function endOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999),
  );
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: number }).code === 11000;
}

async function loadCategories(ids: string[]): Promise<Map<string, CategorySummary>> {
  if (ids.length === 0) return new Map();
  const rows = await Category.find({ _id: { $in: ids } })
    .select('name slug status')
    .lean();
  return new Map(
    rows.map((row) => [
      row._id.toString(),
      { id: row._id.toString(), name: row.name, slug: row.slug },
    ]),
  );
}

async function assertCategories(ids: string[]): Promise<CategorySummary[]> {
  const unique = uniqueIds(ids);
  const found = await Category.find({ _id: { $in: unique } })
    .select('name slug')
    .lean();
  if (found.length !== unique.length) {
    throw new AppError('One or more role categories were not found', HTTP_STATUS.BAD_REQUEST);
  }
  const byId = new Map(found.map((row) => [row._id.toString(), row]));
  return unique.map((id) => {
    const row = byId.get(id)!;
    return { id, name: row.name, slug: row.slug };
  });
}

function mapAdmin(
  doc: {
    _id: { toString(): string };
    companyName: string;
    description?: string | null;
    bannerUrl: string;
    mobileBannerUrl?: string | null;
    linkUrl: string;
    fromDate: Date;
    toDate: Date;
    amount: number;
    type: string;
    categoryIds?: Array<{ toString(): string }>;
    status?: string | null;
    clickCount?: number | null;
    uniqueUserCount?: number | null;
    createdAt?: Date;
    updatedAt?: Date;
  },
  categories: CategorySummary[],
) {
  return {
    id: doc._id.toString(),
    companyName: doc.companyName,
    description: doc.description ?? '',
    bannerUrl: doc.bannerUrl,
    mobileBannerUrl: doc.mobileBannerUrl ?? '',
    linkUrl: doc.linkUrl,
    fromDate: doc.fromDate,
    toDate: doc.toDate,
    amount: doc.amount,
    type: doc.type,
    categoryIds: (doc.categoryIds ?? []).map((id) => id.toString()),
    categories,
    status: doc.status ?? 'inactive',
    clickCount: doc.clickCount ?? 0,
    uniqueUserCount: doc.uniqueUserCount ?? 0,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

async function categoriesForIds(ids: string[]): Promise<CategorySummary[]> {
  const unique = uniqueIds(ids);
  const found = await loadCategories(unique);
  return unique
    .map((id) => found.get(id))
    .filter((item): item is CategorySummary => Boolean(item));
}

function liveFilter(now = new Date()) {
  return {
    status: 'active' as const,
    fromDate: { $lte: now },
    toDate: { $gte: now },
  };
}

export class RoleAdService {
  async list(query: RoleAdQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.categoryId) filter.categoryIds = query.categoryId;
    if (query.search) {
      filter.companyName = { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      RoleAd.countDocuments(filter),
      RoleAd.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    ]);
    const categoryIds = uniqueIds(rows.flatMap((row) => (row.categoryIds ?? []).map((id) => id.toString())));
    const categories = await loadCategories(categoryIds);
    return {
      ads: rows.map((row) =>
        mapAdmin(
          row,
          (row.categoryIds ?? [])
            .map((id) => categories.get(id.toString()))
            .filter((item): item is CategorySummary => Boolean(item)),
        ),
      ),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getById(id: string) {
    const ad = await RoleAd.findById(id);
    if (!ad) throw new AppError('Ad not found', HTTP_STATUS.NOT_FOUND);
    const categories = await categoriesForIds(ad.categoryIds.map((item) => item.toString()));
    return { ad: mapAdmin(ad, categories) };
  }

  async create(input: RoleAdCreateInput) {
    const categories = await assertCategories(input.categoryIds);
    const ad = await RoleAd.create({
      ...input,
      categoryIds: categories.map((item) => item.id),
      fromDate: startOfUtcDay(input.fromDate),
      toDate: endOfUtcDay(input.toDate),
    });
    return { ad: mapAdmin(ad, categories) };
  }

  async update(id: string, input: RoleAdUpdateInput) {
    const ad = await RoleAd.findById(id);
    if (!ad) throw new AppError('Ad not found', HTTP_STATUS.NOT_FOUND);

    const nextFrom = input.fromDate ? startOfUtcDay(input.fromDate) : ad.fromDate;
    const nextTo = input.toDate ? endOfUtcDay(input.toDate) : ad.toDate;
    if (nextTo < nextFrom) {
      throw new AppError('To date must be on or after from date', HTTP_STATUS.BAD_REQUEST);
    }

    let categories: CategorySummary[] | null = null;
    if (input.categoryIds) {
      categories = await assertCategories(input.categoryIds);
    }

    if (input.companyName !== undefined) ad.companyName = input.companyName;
    if (input.description !== undefined) ad.description = input.description;
    if (input.bannerUrl !== undefined) ad.bannerUrl = input.bannerUrl;
    if (input.mobileBannerUrl !== undefined) ad.mobileBannerUrl = input.mobileBannerUrl;
    if (input.linkUrl !== undefined) ad.linkUrl = input.linkUrl;
    if (input.amount !== undefined) ad.amount = input.amount;
    if (input.type !== undefined) ad.type = input.type;
    if (input.status !== undefined) ad.status = input.status;
    ad.fromDate = nextFrom;
    ad.toDate = nextTo;
    if (categories) {
      ad.set(
        'categoryIds',
        categories.map((item) => item.id),
      );
    }
    await ad.save();
    const resolved =
      categories ?? (await categoriesForIds(ad.categoryIds.map((item) => item.toString())));
    return { ad: mapAdmin(ad, resolved) };
  }

  async remove(id: string) {
    const ad = await RoleAd.findByIdAndDelete(id);
    if (!ad) throw new AppError('Ad not found', HTTP_STATUS.NOT_FOUND);
    await RoleAdClick.deleteMany({ adId: ad._id });
    return { deleted: true, id };
  }

  async listClicks(id: string, query: RoleAdClickQuery) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Ad not found', HTTP_STATUS.NOT_FOUND);
    }
    const ad = await RoleAd.findById(id).select('clickCount uniqueUserCount companyName');
    if (!ad) throw new AppError('Ad not found', HTTP_STATUS.NOT_FOUND);
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      RoleAdClick.countDocuments({ adId: ad._id }),
      RoleAdClick.find({ adId: ad._id })
        .sort({ clickCount: -1, lastClickedAt: -1 })
        .skip(skip)
        .limit(query.limit),
    ]);
    return {
      adId: ad._id.toString(),
      companyName: ad.companyName,
      totalClicks: ad.clickCount ?? 0,
      uniqueUsers: ad.uniqueUserCount ?? 0,
      users: rows.map((row) => ({
        userId: row.userId.toString(),
        candidateId: row.candidateId.toString(),
        userName: row.userName ?? '',
        userEmail: row.userEmail ?? '',
        clickCount: row.clickCount ?? 0,
        firstClickedAt: row.firstClickedAt,
        lastClickedAt: row.lastClickedAt,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  /**
   * Live ads whose roles-master categories match the given skill/role labels.
   * Used by career coach, job-match gaps, the website, and the mobile app.
   */
  async findLiveForSkills(skills: string[], limit = 12): Promise<PublicRoleAd[]> {
    const cleaned = [...new Set(skills.map((skill) => skill.trim()).filter((skill) => skill.length >= 2))].slice(
      0,
      40,
    );
    if (cleaned.length === 0) return [];

    const ads = await RoleAd.find(liveFilter()).sort({ fromDate: -1, createdAt: -1 }).limit(80).lean();
    if (ads.length === 0) return [];

    const categoryIds = uniqueIds(
      ads.flatMap((ad) => (ad.categoryIds ?? []).map((id) => id.toString())),
    );
    const categories = await loadCategories(categoryIds);

    const matched: PublicRoleAd[] = [];
    for (const ad of ads) {
      const adCategories = (ad.categoryIds ?? [])
        .map((id) => categories.get(id.toString()))
        .filter((item): item is CategorySummary => Boolean(item));
      const matchedSkills = cleaned.filter((skill) =>
        adCategories.some((category) => skillMatchesRole(skill, category)),
      );
      if (matchedSkills.length === 0) continue;
      matched.push({
        id: ad._id.toString(),
        companyName: ad.companyName,
        description: ad.description ?? '',
        bannerUrl: ad.bannerUrl,
        mobileBannerUrl: ad.mobileBannerUrl ?? '',
        linkUrl: ad.linkUrl,
        type: ad.type,
        fromDate: ad.fromDate,
        toDate: ad.toDate,
        categories: adCategories,
        matchedSkills,
      });
      if (matched.length >= limit) break;
    }
    return matched;
  }

  async recordClick(candidate: AuthenticatedCandidate, id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Ad not found', HTTP_STATUS.NOT_FOUND);
    }
    const ad = await RoleAd.findOne({ _id: id, ...liveFilter() });
    if (!ad) throw new AppError('Ad is not available', HTTP_STATUS.NOT_FOUND);

    const now = new Date();
    const userObjectId = new mongoose.Types.ObjectId(candidate.userId);
    const candidateObjectId = new mongoose.Types.ObjectId(candidate.candidateId);
    let isNewUser = false;

    try {
      const previous = await RoleAdClick.findOneAndUpdate(
        { adId: ad._id, userId: userObjectId },
        {
          $inc: { clickCount: 1 },
          $set: {
            lastClickedAt: now,
            userName: candidate.name ?? '',
            userEmail: candidate.email ?? '',
            candidateId: candidateObjectId,
          },
          $setOnInsert: { firstClickedAt: now },
        },
        { upsert: true, new: false },
      );
      isNewUser = !previous;
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      await RoleAdClick.updateOne(
        { adId: ad._id, userId: userObjectId },
        {
          $inc: { clickCount: 1 },
          $set: { lastClickedAt: now, userName: candidate.name ?? '', userEmail: candidate.email ?? '' },
        },
      );
      isNewUser = false;
    }

    const updated = await RoleAd.findByIdAndUpdate(
      ad._id,
      { $inc: { clickCount: 1, ...(isNewUser ? { uniqueUserCount: 1 } : {}) } },
      { new: true },
    );
    const userRow = await RoleAdClick.findOne({ adId: ad._id, userId: userObjectId }).select('clickCount');

    return {
      recorded: true,
      adId: ad._id.toString(),
      linkUrl: ad.linkUrl,
      totalClicks: updated?.clickCount ?? ad.clickCount + 1,
      userClickCount: userRow?.clickCount ?? 1,
    };
  }
}

export const roleAdService = new RoleAdService();
