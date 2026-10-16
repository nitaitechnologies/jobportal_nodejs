import { HTTP_STATUS } from '../constants';
import { RecruiterTestimonial } from '../models/RecruiterTestimonial';
import { AppError } from '../utils/AppError';
import type {
  RecruiterTestimonialCreateInput,
  RecruiterTestimonialQuery,
  RecruiterTestimonialUpdateInput,
} from '../validators/recruiterTestimonial.validator';

function mapTestimonial(doc: {
  _id: { toString(): string };
  recruiterName: string;
  companyName: string;
  roleTitle?: string | null;
  quote: string;
  rating?: number | null;
  avatarUrl?: string | null;
  status?: string;
  sortOrder?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    recruiterName: doc.recruiterName,
    companyName: doc.companyName,
    roleTitle: doc.roleTitle ?? '',
    quote: doc.quote,
    rating: doc.rating ?? 5,
    avatarUrl: doc.avatarUrl ?? '',
    status: doc.status ?? 'inactive',
    sortOrder: doc.sortOrder ?? 0,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

export class RecruiterTestimonialService {
  async list(query: RecruiterTestimonialQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.q?.trim()) {
      const needle = query.q.trim();
      filter.$or = [
        { recruiterName: { $regex: needle, $options: 'i' } },
        { companyName: { $regex: needle, $options: 'i' } },
        { quote: { $regex: needle, $options: 'i' } },
      ];
    }
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      RecruiterTestimonial.countDocuments(filter),
      RecruiterTestimonial.find(filter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(query.limit),
    ]);
    return {
      testimonials: rows.map((row) => mapTestimonial(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async listPublic(limit = 20) {
    const capped = Math.min(Math.max(1, limit), 50);
    const rows = await RecruiterTestimonial.find({ status: 'active' })
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(capped);
    return {
      testimonials: rows.map((row) => ({
        id: row._id.toString(),
        recruiterName: row.recruiterName,
        companyName: row.companyName,
        roleTitle: row.roleTitle ?? '',
        quote: row.quote,
        rating: row.rating ?? 5,
        avatarUrl: row.avatarUrl ?? '',
        sortOrder: row.sortOrder ?? 0,
      })),
    };
  }

  async getById(id: string) {
    const row = await RecruiterTestimonial.findById(id);
    if (!row) throw new AppError('Testimonial not found', HTTP_STATUS.NOT_FOUND);
    return { testimonial: mapTestimonial(row) };
  }

  async create(input: RecruiterTestimonialCreateInput) {
    const row = await RecruiterTestimonial.create(input);
    return { testimonial: mapTestimonial(row) };
  }

  async update(id: string, input: RecruiterTestimonialUpdateInput) {
    const row = await RecruiterTestimonial.findById(id);
    if (!row) throw new AppError('Testimonial not found', HTTP_STATUS.NOT_FOUND);
    Object.assign(row, input);
    await row.save();
    return { testimonial: mapTestimonial(row) };
  }

  async remove(id: string) {
    const row = await RecruiterTestimonial.findByIdAndDelete(id);
    if (!row) throw new AppError('Testimonial not found', HTTP_STATUS.NOT_FOUND);
    return { deleted: true, id };
  }
}

export const recruiterTestimonialService = new RecruiterTestimonialService();
