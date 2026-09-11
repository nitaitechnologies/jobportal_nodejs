import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import type { ArticleStatus } from '../constants/enums';
import { CareerArticle } from '../models/CareerArticle';
import { User } from '../models/User';
import type { AuthenticatedAdmin } from '../types/auth.types';
import { sanitizeArticleContent } from '../utils/articleContent';
import {
  canArchiveArticle,
  canPublishArticle,
  canTransitionArticleStatus,
  canUnpublishArticle,
} from '../utils/articleStatus';
import { AppError } from '../utils/AppError';
import {
  mapAdminCareerArticle,
  mapPublicCareerArticle,
  mapPublicCareerArticleSummary,
  type PublicAuthor,
} from '../utils/careerArticleMapper';
import { createUniqueSlug } from '../utils/slug';
import { trackSafely } from './analytics.service';
import type {
  AdminCareerAdviceQuery,
  CareerArticleCreateInput,
  CareerArticleUpdateInput,
  PublicCareerAdviceQuery,
} from '../validators/careerAdvice.validator';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

async function uniqueArticleSlug(title: string, excludeId?: string): Promise<string> {
  return createUniqueSlug(title, async (value) => {
    const query: Record<string, unknown> = { slug: value };
    if (excludeId) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }
    const existing = await CareerArticle.findOne(query).select('_id');
    return Boolean(existing);
  });
}

async function loadAuthors(
  authorIds: Array<mongoose.Types.ObjectId | string>,
): Promise<Map<string, PublicAuthor>> {
  const unique = [...new Set(authorIds.map((id) => id.toString()))];
  if (unique.length === 0) {
    return new Map();
  }
  const users = await User.find({ _id: { $in: unique } }).select('name');
  const map = new Map<string, PublicAuthor>();
  for (const user of users) {
    map.set(user._id.toString(), {
      id: user._id.toString(),
      name: user.name,
    });
  }
  return map;
}

function publicSort(sort: PublicCareerAdviceQuery['sort']): Record<string, 1 | -1> {
  switch (sort) {
    case 'oldest':
      return { publishedAt: 1, createdAt: 1 };
    case 'popular':
      return { views: -1, publishedAt: -1 };
    case 'latest':
    default:
      return { publishedAt: -1, createdAt: -1 };
  }
}

export class CareerAdviceService {
  async listPublic(query: PublicCareerAdviceQuery) {
    const filter: Record<string, unknown> = { status: 'published' };

    if (query.category) {
      filter.category = {
        $regex: `^${escapeRegex(query.category.trim())}$`,
        $options: 'i',
      };
    }

    if (query.tag) {
      filter.tags = {
        $elemMatch: {
          $regex: `^${escapeRegex(query.tag.trim())}$`,
          $options: 'i',
        },
      };
    }

    if (query.q) {
      filter.$text = { $search: query.q };
    }

    const skip = (query.page - 1) * query.limit;
    const baseSort = publicSort(query.sort);

    const findQuery = query.q
      ? CareerArticle.find(filter)
          .select({ content: 0, score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' }, ...baseSort })
          .skip(skip)
          .limit(query.limit)
      : CareerArticle.find(filter)
          .select('-content')
          .sort(baseSort)
          .skip(skip)
          .limit(query.limit);

    const [total, rows] = await Promise.all([
      CareerArticle.countDocuments(filter),
      findQuery,
    ]);

    const authors = await loadAuthors(rows.map((row) => row.authorId));
    return {
      articles: rows.map((row) =>
        mapPublicCareerArticleSummary(row, authors.get(row.authorId.toString()) ?? null),
      ),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getPublicBySlug(slug: string) {
    const article = await CareerArticle.findOne({
      slug: slug.toLowerCase(),
      status: 'published',
    });
    if (!article) {
      throw new AppError('Article not found', HTTP_STATUS.NOT_FOUND);
    }

    await CareerArticle.updateOne({ _id: article._id }, { $inc: { views: 1 } });
    article.views = (article.views ?? 0) + 1;

    await trackSafely({
      eventType: 'career_article_view',
      actorRole: 'anonymous',
      entityType: 'article',
      entityId: article._id,
      metadata: { slug: article.slug, category: article.category },
    });

    const authors = await loadAuthors([article.authorId]);
    return {
      article: mapPublicCareerArticle(
        article,
        authors.get(article.authorId.toString()) ?? null,
      ),
    };
  }

  async create(admin: AuthenticatedAdmin, input: CareerArticleCreateInput) {
    const slug = await uniqueArticleSlug(input.title);
    const content = sanitizeArticleContent(input.content);

    try {
      const article = await CareerArticle.create({
        title: input.title,
        slug,
        excerpt: input.excerpt,
        content,
        featuredImage: input.featuredImage,
        authorId: new mongoose.Types.ObjectId(admin.userId),
        category: input.category,
        tags: input.tags,
        status: 'draft',
        views: 0,
        seoTitle: input.seoTitle || input.title.slice(0, 70),
        seoDescription: input.seoDescription || input.excerpt.slice(0, 160),
      });

      return {
        article: mapAdminCareerArticle(article, {
          id: admin.userId,
          name: admin.name,
        }),
      };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AppError('An article with this slug already exists', HTTP_STATUS.CONFLICT);
      }
      throw error;
    }
  }

  async listAdmin(query: AdminCareerAdviceQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) {
      filter.status = query.status;
    }
    if (query.category) {
      filter.category = {
        $regex: `^${escapeRegex(query.category.trim())}$`,
        $options: 'i',
      };
    }
    if (query.q) {
      filter.$or = [
        { title: { $regex: escapeRegex(query.q), $options: 'i' } },
        { excerpt: { $regex: escapeRegex(query.q), $options: 'i' } },
        { slug: { $regex: escapeRegex(query.q), $options: 'i' } },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      CareerArticle.countDocuments(filter),
      CareerArticle.find(filter)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(query.limit),
    ]);

    const authors = await loadAuthors(rows.map((row) => row.authorId));
    return {
      articles: rows.map((row) =>
        mapAdminCareerArticle(row, authors.get(row.authorId.toString()) ?? null),
      ),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getAdminById(id: string) {
    const article = await CareerArticle.findById(id);
    if (!article) {
      throw new AppError('Article not found', HTTP_STATUS.NOT_FOUND);
    }
    const authors = await loadAuthors([article.authorId]);
    return {
      article: mapAdminCareerArticle(
        article,
        authors.get(article.authorId.toString()) ?? null,
      ),
    };
  }

  async update(id: string, input: CareerArticleUpdateInput) {
    const article = await CareerArticle.findById(id);
    if (!article) {
      throw new AppError('Article not found', HTTP_STATUS.NOT_FOUND);
    }

    if (input.title !== undefined) {
      article.title = input.title;
      // Slug stays stable on title change.
    }
    if (input.excerpt !== undefined) {
      article.excerpt = input.excerpt;
    }
    if (input.content !== undefined) {
      article.content = sanitizeArticleContent(input.content);
    }
    if (input.featuredImage !== undefined) {
      article.featuredImage = input.featuredImage;
    }
    if (input.category !== undefined) {
      article.category = input.category;
    }
    if (input.tags !== undefined) {
      article.tags = input.tags;
    }
    if (input.seoTitle !== undefined) {
      article.seoTitle = input.seoTitle;
    }
    if (input.seoDescription !== undefined) {
      article.seoDescription = input.seoDescription;
    }

    await article.save();
    const authors = await loadAuthors([article.authorId]);
    return {
      article: mapAdminCareerArticle(
        article,
        authors.get(article.authorId.toString()) ?? null,
      ),
    };
  }

  async publish(id: string) {
    const article = await CareerArticle.findById(id);
    if (!article) {
      throw new AppError('Article not found', HTTP_STATUS.NOT_FOUND);
    }

    const status = article.status as ArticleStatus;
    if (!canPublishArticle(status)) {
      throw new AppError('Article cannot be published from this status', HTTP_STATUS.BAD_REQUEST);
    }

    if (status === 'published') {
      const authors = await loadAuthors([article.authorId]);
      return {
        article: mapAdminCareerArticle(
          article,
          authors.get(article.authorId.toString()) ?? null,
        ),
      };
    }

    if (!canTransitionArticleStatus(status, 'published')) {
      throw new AppError('Invalid status transition', HTTP_STATUS.BAD_REQUEST);
    }

    article.status = 'published';
    article.publishedAt = new Date();
    await article.save();

    const authors = await loadAuthors([article.authorId]);
    return {
      article: mapAdminCareerArticle(
        article,
        authors.get(article.authorId.toString()) ?? null,
      ),
    };
  }

  async unpublish(id: string) {
    const article = await CareerArticle.findById(id);
    if (!article) {
      throw new AppError('Article not found', HTTP_STATUS.NOT_FOUND);
    }

    const status = article.status as ArticleStatus;
    if (!canUnpublishArticle(status)) {
      throw new AppError(
        'Article cannot be unpublished from this status',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (status === 'draft') {
      const authors = await loadAuthors([article.authorId]);
      return {
        article: mapAdminCareerArticle(
          article,
          authors.get(article.authorId.toString()) ?? null,
        ),
      };
    }

    if (!canTransitionArticleStatus(status, 'draft')) {
      throw new AppError('Invalid status transition', HTTP_STATUS.BAD_REQUEST);
    }

    article.status = 'draft';
    await article.save();

    const authors = await loadAuthors([article.authorId]);
    return {
      article: mapAdminCareerArticle(
        article,
        authors.get(article.authorId.toString()) ?? null,
      ),
    };
  }

  async archive(id: string) {
    const article = await CareerArticle.findById(id);
    if (!article) {
      throw new AppError('Article not found', HTTP_STATUS.NOT_FOUND);
    }

    const status = article.status as ArticleStatus;
    if (!canArchiveArticle(status)) {
      throw new AppError('Article cannot be archived', HTTP_STATUS.BAD_REQUEST);
    }

    if (status === 'archived') {
      return {
        article: mapAdminCareerArticle(article),
        message: 'Article already archived',
      };
    }

    if (!canTransitionArticleStatus(status, 'archived')) {
      throw new AppError('Invalid status transition', HTTP_STATUS.BAD_REQUEST);
    }

    article.status = 'archived';
    await article.save();

    const authors = await loadAuthors([article.authorId]);
    return {
      article: mapAdminCareerArticle(
        article,
        authors.get(article.authorId.toString()) ?? null,
      ),
      message: 'Article archived successfully',
    };
  }
}

export const careerAdviceService = new CareerAdviceService();
