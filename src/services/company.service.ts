import mongoose from 'mongoose';
import { Company } from '../models/Company';
import { CompanyReview } from '../models/CompanyReview';
import { Candidate } from '../models/Candidate';
import { Employer } from '../models/Employer';
import { Job } from '../models/Job';
import { User } from '../models/User';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import {
  isCompanyPubliclyVisible,
  mapEmployerOwnedCompany,
  mapPublicCompany,
} from '../utils/companyMapper';
import { mapPublicJobSummary } from '../utils/jobMapper';
import type {
  CompanyJobsQuery,
  CompanyProfileUpdateInput,
  CompanyReviewCreateInput,
  CompanyReviewsQuery,
  CompanyReviewUpdateInput,
} from '../validators/employerCompany.validator';

type AuthenticatedCandidate = {
  userId: string;
  candidateId: string;
};

async function recountCompanyRatings(companyId: mongoose.Types.ObjectId | string) {
  const rows = await CompanyReview.aggregate<{ _id: null; avg: number; count: number }>([
    {
      $match: {
        companyId: new mongoose.Types.ObjectId(String(companyId)),
        status: 'published',
      },
    },
    {
      $group: {
        _id: null,
        avg: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  const avg = rows[0]?.avg ?? 0;
  const count = rows[0]?.count ?? 0;
  await Company.findByIdAndUpdate(companyId, {
    ratingAvg: Math.round(avg * 10) / 10,
    ratingCount: count,
  });
}

async function countOpenJobs(companyId: mongoose.Types.ObjectId | string): Promise<number> {
  const now = new Date();
  return Job.countDocuments({
    companyId,
    status: 'published',
    deletedAt: null,
    $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
  });
}

export class CompanyService {
  private async resolveOwnedCompany(userId: string) {
    const [user, employer] = await Promise.all([
      User.findById(userId).select('role status deletedAt'),
      Employer.findOne({ userId }),
    ]);

    if (!user || user.role !== 'employer' || user.deletedAt) {
      throw new AppError('Employer not found', HTTP_STATUS.NOT_FOUND);
    }

    if (user.status !== 'active') {
      throw new AppError('Employer access denied', HTTP_STATUS.FORBIDDEN);
    }

    if (!employer || employer.status !== 'active' || !employer.companyId) {
      throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);
    }

    const company = await Company.findById(employer.companyId);
    if (!company) {
      throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);
    }

    return { user, employer, company };
  }

  private async findPublicCompanyBySlug(slug: string) {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) {
      throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);
    }

    const company = await Company.findOne({ slug: normalized });
    if (!company || !isCompanyPubliclyVisible(company)) {
      throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);
    }
    return company;
  }

  async getOwnedCompany(userId: string) {
    const { company } = await this.resolveOwnedCompany(userId);
    return { company: mapEmployerOwnedCompany(company) };
  }

  async updateOwnedCompany(userId: string, input: CompanyProfileUpdateInput) {
    const { company } = await this.resolveOwnedCompany(userId);

    if (input.name !== undefined) {
      company.name = input.name;
    }
    if (input.description !== undefined) {
      company.description = input.description;
    }
    if (input.website !== undefined) {
      company.website = input.website;
    }
    if (input.industry !== undefined) {
      company.industry = input.industry;
    }
    if (input.companySize !== undefined) {
      company.companySize = input.companySize;
    }
    if (input.foundedYear !== undefined) {
      company.foundedYear = input.foundedYear ?? undefined;
    }
    if (input.headquarters !== undefined) {
      company.headquarters = input.headquarters;
    }
    if (input.locations !== undefined) {
      company.locations = input.locations;
    }
    if (input.contactEmail !== undefined) {
      company.contactEmail = input.contactEmail;
    }
    if (input.contactPhone !== undefined) {
      company.contactPhone = input.contactPhone;
    }
    if (input.logo !== undefined) {
      company.logo = input.logo;
    }
    if (input.coverImage !== undefined) {
      company.coverImage = input.coverImage;
    }
    if (input.benefits !== undefined) {
      company.benefits = input.benefits;
    }
    if (input.gallery !== undefined) {
      company.set(
        'gallery',
        input.gallery.map((item, index) => ({
          url: item.url,
          type: item.type ?? 'image',
          caption: item.caption ?? '',
          sortOrder: item.sortOrder ?? index,
        })),
      );
    }
    if (input.socialLinks !== undefined) {
      company.socialLinks = {
        linkedin: input.socialLinks.linkedin ?? company.socialLinks?.linkedin ?? '',
        twitter: input.socialLinks.twitter ?? company.socialLinks?.twitter ?? '',
        facebook: input.socialLinks.facebook ?? company.socialLinks?.facebook ?? '',
        instagram: input.socialLinks.instagram ?? company.socialLinks?.instagram ?? '',
        github: input.socialLinks.github ?? company.socialLinks?.github ?? '',
        website: input.socialLinks.website ?? company.socialLinks?.website ?? '',
      };
    }

    await company.save();

    return { company: mapEmployerOwnedCompany(company) };
  }

  async getPublicCompanyBySlug(slug: string) {
    const company = await this.findPublicCompanyBySlug(slug);
    const openJobsCount = await countOpenJobs(company._id);
    return { company: mapPublicCompany(company, { openJobsCount }) };
  }

  /** Featured companies for homepage / directory (sheet 420). */
  async listPublicFeatured(limit = 12) {
    const capped = Math.min(Math.max(limit, 1), 50);
    const rows = await Company.find({
      featured: true,
      status: 'active',
      verificationStatus: { $ne: 'rejected' },
    })
      .sort({ featuredAt: -1, updatedAt: -1 })
      .limit(capped);

    const companies = await Promise.all(
      rows.map(async (company) =>
        mapPublicCompany(company, { openJobsCount: await countOpenJobs(company._id) }),
      ),
    );
    return { companies };
  }

  async listPublicJobsBySlug(slug: string, query: CompanyJobsQuery) {
    const company = await this.findPublicCompanyBySlug(slug);
    const now = new Date();
    const filter = {
      companyId: company._id,
      status: 'published' as const,
      deletedAt: null,
      $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
    };

    const skip = (query.page - 1) * query.limit;
    const [total, jobs] = await Promise.all([
      Job.countDocuments(filter),
      Job.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip(skip).limit(query.limit),
    ]);

    const companySummary = {
      id: company._id.toString(),
      name: company.name,
      slug: company.slug,
      logo: company.logo ?? '',
      industry: company.industry ?? '',
      companySize: company.companySize ?? null,
      headquarters: company.headquarters ?? '',
      verificationStatus: company.verificationStatus,
    };

    return {
      jobs: jobs.map((job) =>
        mapPublicJobSummary(job, {
          company: companySummary,
        }),
      ),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async listPublishedReviews(slug: string, query: CompanyReviewsQuery) {
    const company = await this.findPublicCompanyBySlug(slug);
    const filter = { companyId: company._id, status: 'published' as const };
    const skip = (query.page - 1) * query.limit;

    const [total, rows] = await Promise.all([
      CompanyReview.countDocuments(filter),
      CompanyReview.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    ]);

    const candidateIds = rows.map((r) => r.candidateId);
    const candidates = await Candidate.find({ _id: { $in: candidateIds } }).select('userId');
    const userIds = candidates.map((c) => c.userId);
    const users = await User.find({ _id: { $in: userIds } }).select('name');
    const userNameById = new Map(users.map((u) => [u._id.toString(), u.name]));
    const userIdByCandidate = new Map(
      candidates.map((c) => [c._id.toString(), c.userId.toString()]),
    );

    return {
      reviews: rows.map((row) => {
        const candId = row.candidateId.toString();
        const userId = userIdByCandidate.get(candId);
        const name = userId ? userNameById.get(userId) : undefined;
        return {
          id: row._id.toString(),
          rating: row.rating,
          title: row.title ?? '',
          body: row.body,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          author: {
            displayName: name ? `${name.split(' ')[0]}` : 'Candidate',
          },
        };
      }),
      summary: {
        ratingAvg: company.ratingAvg ?? 0,
        ratingCount: company.ratingCount ?? 0,
      },
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async upsertMyReview(
    candidate: AuthenticatedCandidate,
    slug: string,
    input: CompanyReviewCreateInput,
  ) {
    const company = await this.findPublicCompanyBySlug(slug);

    const existing = await CompanyReview.findOne({
      companyId: company._id,
      candidateId: candidate.candidateId,
    });

    if (existing) {
      existing.rating = input.rating;
      existing.title = input.title ?? '';
      existing.body = input.body;
      existing.status = 'published';
      await existing.save();
      await recountCompanyRatings(company._id);
      const refreshed = await Company.findById(company._id);
      return {
        review: {
          id: existing._id.toString(),
          rating: existing.rating,
          title: existing.title ?? '',
          body: existing.body,
          status: existing.status,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        },
        summary: {
          ratingAvg: refreshed?.ratingAvg ?? 0,
          ratingCount: refreshed?.ratingCount ?? 0,
        },
      };
    }

    const created = await CompanyReview.create({
      companyId: company._id,
      candidateId: candidate.candidateId,
      rating: input.rating,
      title: input.title ?? '',
      body: input.body,
      status: 'published',
    });
    await recountCompanyRatings(company._id);
    const refreshed = await Company.findById(company._id);

    return {
      review: {
        id: created._id.toString(),
        rating: created.rating,
        title: created.title ?? '',
        body: created.body,
        status: created.status,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
      summary: {
        ratingAvg: refreshed?.ratingAvg ?? 0,
        ratingCount: refreshed?.ratingCount ?? 0,
      },
    };
  }

  async updateMyReview(
    candidate: AuthenticatedCandidate,
    reviewId: string,
    input: CompanyReviewUpdateInput,
  ) {
    const review = await CompanyReview.findOne({
      _id: reviewId,
      candidateId: candidate.candidateId,
    });
    if (!review) {
      throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);
    }

    if (input.rating !== undefined) review.rating = input.rating;
    if (input.title !== undefined) review.title = input.title;
    if (input.body !== undefined) review.body = input.body;
    review.status = 'published';
    await review.save();
    await recountCompanyRatings(review.companyId);

    const refreshed = await Company.findById(review.companyId);
    return {
      review: {
        id: review._id.toString(),
        rating: review.rating,
        title: review.title ?? '',
        body: review.body,
        status: review.status,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
      },
      summary: {
        ratingAvg: refreshed?.ratingAvg ?? 0,
        ratingCount: refreshed?.ratingCount ?? 0,
      },
    };
  }

  async deleteMyReview(candidate: AuthenticatedCandidate, reviewId: string) {
    const review = await CompanyReview.findOne({
      _id: reviewId,
      candidateId: candidate.candidateId,
    });
    if (!review) {
      throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);
    }

    const companyId = review.companyId;
    await review.deleteOne();
    await recountCompanyRatings(companyId);
    return { deleted: true as const };
  }
}

export const companyService = new CompanyService();
