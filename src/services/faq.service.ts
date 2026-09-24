import { HTTP_STATUS } from '../constants';
import { FaqItem } from '../models/FaqItem';
import { AppError } from '../utils/AppError';
import { createUniqueSlug, slugify } from '../utils/slug';
import type { FaqCreateInput, FaqQuery, FaqUpdateInput } from '../validators/faq.validator';

function mapFaq(doc: {
  _id: { toString(): string };
  question: string;
  answer: string;
  slug: string;
  category?: string;
  status?: string;
  sortOrder?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    question: doc.question,
    answer: doc.answer,
    slug: doc.slug,
    category: doc.category ?? 'general',
    status: doc.status ?? 'inactive',
    sortOrder: doc.sortOrder ?? 0,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

export class FaqService {
  async list(query: FaqQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.q?.trim()) {
      const rx = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { question: { $regex: rx, $options: 'i' } },
        { answer: { $regex: rx, $options: 'i' } },
      ];
    }
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      FaqItem.countDocuments(filter),
      FaqItem.find(filter).sort({ sortOrder: 1, createdAt: -1 }).skip(skip).limit(query.limit),
    ]);
    return {
      faqs: rows.map((row) => mapFaq(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  /** Public published FAQs only (sheet 422). */
  async listPublic(opts?: {
    category?: 'general' | 'candidate' | 'employer' | 'payments' | 'safety';
    q?: string;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 100);
    return this.list({
      page: 1,
      limit,
      status: 'active',
      category: opts?.category,
      q: opts?.q,
    });
  }

  async getById(id: string) {
    const faq = await FaqItem.findById(id);
    if (!faq) throw new AppError('FAQ not found', HTTP_STATUS.NOT_FOUND);
    return { faq: mapFaq(faq) };
  }

  async create(input: FaqCreateInput) {
    const slug = await createUniqueSlug(
      input.slug?.trim() ? input.slug : slugify(input.question),
      async (value) => Boolean(await FaqItem.findOne({ slug: value }).select('_id')),
    );
    const faq = await FaqItem.create({ ...input, slug });
    return { faq: mapFaq(faq) };
  }

  async update(id: string, input: FaqUpdateInput) {
    const faq = await FaqItem.findById(id);
    if (!faq) throw new AppError('FAQ not found', HTTP_STATUS.NOT_FOUND);
    if (input.question !== undefined) faq.question = input.question;
    if (input.answer !== undefined) faq.answer = input.answer;
    if (input.category !== undefined) faq.category = input.category;
    if (input.status !== undefined) faq.status = input.status;
    if (input.sortOrder !== undefined) faq.sortOrder = input.sortOrder;
    if (input.slug !== undefined && input.slug.trim()) {
      faq.slug = await createUniqueSlug(input.slug, async (value) =>
        Boolean(await FaqItem.findOne({ slug: value, _id: { $ne: faq._id } }).select('_id')),
      );
    }
    await faq.save();
    return { faq: mapFaq(faq) };
  }

  async remove(id: string) {
    const faq = await FaqItem.findByIdAndDelete(id);
    if (!faq) throw new AppError('FAQ not found', HTTP_STATUS.NOT_FOUND);
    return { deleted: true, id };
  }
}

export const faqService = new FaqService();
