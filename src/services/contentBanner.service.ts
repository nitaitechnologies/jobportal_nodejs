import { HTTP_STATUS } from '../constants';
import { ContentBanner } from '../models/ContentBanner';
import { AppError } from '../utils/AppError';
import type {
  BannerCreateInput,
  BannerQuery,
  BannerUpdateInput,
} from '../validators/contentBanner.validator';

function mapBanner(doc: {
  _id: { toString(): string };
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  ctaLabel?: string | null;
  placement?: string;
  status?: string;
  sortOrder?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    subtitle: doc.subtitle ?? '',
    imageUrl: doc.imageUrl ?? '',
    linkUrl: doc.linkUrl ?? '',
    ctaLabel: doc.ctaLabel ?? '',
    placement: doc.placement ?? 'homepage_hero',
    status: doc.status ?? 'inactive',
    sortOrder: doc.sortOrder ?? 0,
    startsAt: doc.startsAt ?? null,
    endsAt: doc.endsAt ?? null,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

export class ContentBannerService {
  async list(query: BannerQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.placement) filter.placement = query.placement;
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      ContentBanner.countDocuments(filter),
      ContentBanner.find(filter).sort({ sortOrder: 1, createdAt: -1 }).skip(skip).limit(query.limit),
    ]);
    return {
      banners: rows.map((row) => mapBanner(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  /** Public active banners within optional schedule window (sheet 419). */
  async listPublic(placement?: string) {
    const now = new Date();
    const filter: Record<string, unknown> = {
      status: 'active',
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gte: now } }] },
      ],
    };
    if (placement) filter.placement = placement;
    const rows = await ContentBanner.find(filter).sort({ sortOrder: 1, createdAt: -1 }).limit(20);
    return {
      banners: rows.map((row) => ({
        id: row._id.toString(),
        title: row.title,
        subtitle: row.subtitle ?? '',
        imageUrl: row.imageUrl ?? '',
        linkUrl: row.linkUrl ?? '',
        ctaLabel: row.ctaLabel ?? '',
        placement: row.placement ?? 'homepage_hero',
        sortOrder: row.sortOrder ?? 0,
      })),
    };
  }

  async getById(id: string) {
    const banner = await ContentBanner.findById(id);
    if (!banner) throw new AppError('Banner not found', HTTP_STATUS.NOT_FOUND);
    return { banner: mapBanner(banner) };
  }

  async create(input: BannerCreateInput) {
    const banner = await ContentBanner.create(input);
    return { banner: mapBanner(banner) };
  }

  async update(id: string, input: BannerUpdateInput) {
    const banner = await ContentBanner.findById(id);
    if (!banner) throw new AppError('Banner not found', HTTP_STATUS.NOT_FOUND);
    Object.assign(banner, input);
    await banner.save();
    return { banner: mapBanner(banner) };
  }

  async remove(id: string) {
    const banner = await ContentBanner.findByIdAndDelete(id);
    if (!banner) throw new AppError('Banner not found', HTTP_STATUS.NOT_FOUND);
    return { deleted: true, id };
  }
}

export const contentBannerService = new ContentBannerService();
