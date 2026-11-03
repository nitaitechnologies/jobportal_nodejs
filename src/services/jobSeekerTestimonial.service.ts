import { HTTP_STATUS } from '../constants';
import { JobSeekerTestimonial } from '../models/JobSeekerTestimonial';
import { AppError } from '../utils/AppError';
import type {
  JobSeekerTestimonialCreateInput,
  JobSeekerTestimonialQuery,
  JobSeekerTestimonialUpdateInput,
} from '../validators/jobSeekerTestimonial.validator';

function mapTestimonial(doc: {
  _id: { toString(): string };
  seekerName: string;
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
    seekerName: doc.seekerName,
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

export class JobSeekerTestimonialService {
  async list(query: JobSeekerTestimonialQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.q?.trim()) {
      const needle = query.q.trim();
      filter.$or = [
        { seekerName: { $regex: needle, $options: 'i' } },
        { companyName: { $regex: needle, $options: 'i' } },
        { roleTitle: { $regex: needle, $options: 'i' } },
        { quote: { $regex: needle, $options: 'i' } },
      ];
    }
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      JobSeekerTestimonial.countDocuments(filter),
      JobSeekerTestimonial.find(filter)
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
    const rows = await JobSeekerTestimonial.find({ status: 'active' })
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(capped);
    return {
      testimonials: rows.map((row) => ({
        id: row._id.toString(),
        seekerName: row.seekerName,
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
    const row = await JobSeekerTestimonial.findById(id);
    if (!row) throw new AppError('Testimonial not found', HTTP_STATUS.NOT_FOUND);
    return { testimonial: mapTestimonial(row) };
  }

  async create(input: JobSeekerTestimonialCreateInput) {
    const row = await JobSeekerTestimonial.create(input);
    return { testimonial: mapTestimonial(row) };
  }

  async update(id: string, input: JobSeekerTestimonialUpdateInput) {
    const row = await JobSeekerTestimonial.findById(id);
    if (!row) throw new AppError('Testimonial not found', HTTP_STATUS.NOT_FOUND);
    Object.assign(row, input);
    await row.save();
    return { testimonial: mapTestimonial(row) };
  }

  async remove(id: string) {
    const row = await JobSeekerTestimonial.findByIdAndDelete(id);
    if (!row) throw new AppError('Testimonial not found', HTTP_STATUS.NOT_FOUND);
    return { deleted: true, id };
  }
}

export const jobSeekerTestimonialService = new JobSeekerTestimonialService();
