import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { TaxonomyTerm, TAXONOMY_KINDS, type TaxonomyKind } from '../models/TaxonomyTerm';
import { AppError } from '../utils/AppError';
import { createUniqueSlug, slugify } from '../utils/slug';
import type {
  TaxonomyCreateInput,
  TaxonomyQuery,
  TaxonomyUpdateInput,
} from '../validators/taxonomy.validator';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mapTerm(doc: {
  _id: { toString(): string };
  kind: string;
  name: string;
  slug: string;
  description?: string | null;
  status?: string;
  sortOrder?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    kind: doc.kind,
    name: doc.name,
    slug: doc.slug,
    description: doc.description ?? '',
    status: doc.status ?? 'active',
    sortOrder: doc.sortOrder ?? 0,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

async function uniqueSlug(kind: TaxonomyKind, source: string, excludeId?: string) {
  return createUniqueSlug(source, async (value) => {
    const query: Record<string, unknown> = { kind, slug: value };
    if (excludeId) query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    return Boolean(await TaxonomyTerm.findOne(query).select('_id'));
  });
}

export class TaxonomyService {
  async list(query: TaxonomyQuery) {
    const filter: Record<string, unknown> = { kind: query.kind };
    if (query.status) filter.status = query.status;
    if (query.q?.trim()) {
      const rx = escapeRegex(query.q.trim());
      filter.$or = [{ name: { $regex: rx, $options: 'i' } }, { slug: { $regex: rx, $options: 'i' } }];
    }
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      TaxonomyTerm.countDocuments(filter),
      TaxonomyTerm.find(filter).sort({ sortOrder: 1, name: 1 }).skip(skip).limit(query.limit),
    ]);
    return {
      terms: rows.map((row) => mapTerm(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getById(id: string) {
    const term = await TaxonomyTerm.findById(id);
    if (!term) throw new AppError('Taxonomy term not found', HTTP_STATUS.NOT_FOUND);
    return { term: mapTerm(term) };
  }

  async create(input: TaxonomyCreateInput) {
    if (!(TAXONOMY_KINDS as readonly string[]).includes(input.kind)) {
      throw new AppError('Invalid taxonomy kind', HTTP_STATUS.BAD_REQUEST);
    }
    const slug = await uniqueSlug(
      input.kind,
      input.slug?.trim() ? input.slug : slugify(input.name),
    );
    try {
      const term = await TaxonomyTerm.create({
        kind: input.kind,
        name: input.name,
        slug,
        description: input.description ?? '',
        status: input.status ?? 'active',
        sortOrder: input.sortOrder ?? 0,
      });
      return { term: mapTerm(term) };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        throw new AppError('A term with this slug already exists for this kind', HTTP_STATUS.CONFLICT);
      }
      throw error;
    }
  }

  async update(id: string, input: TaxonomyUpdateInput) {
    const term = await TaxonomyTerm.findById(id);
    if (!term) throw new AppError('Taxonomy term not found', HTTP_STATUS.NOT_FOUND);
    if (input.name !== undefined) term.name = input.name;
    if (input.description !== undefined) term.description = input.description;
    if (input.status !== undefined) term.status = input.status;
    if (input.sortOrder !== undefined) term.sortOrder = input.sortOrder;
    if (input.slug !== undefined && input.slug.trim()) {
      term.slug = await uniqueSlug(term.kind as TaxonomyKind, input.slug, id);
    }
    await term.save();
    return { term: mapTerm(term) };
  }

  async remove(id: string) {
    const term = await TaxonomyTerm.findByIdAndDelete(id);
    if (!term) throw new AppError('Taxonomy term not found', HTTP_STATUS.NOT_FOUND);
    return { deleted: true, id };
  }
}

export const taxonomyService = new TaxonomyService();
