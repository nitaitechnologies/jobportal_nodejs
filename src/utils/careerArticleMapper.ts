import type { Types } from 'mongoose';

export interface CareerArticleLike {
  _id: Types.ObjectId | { toString(): string };
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  featuredImage?: string | null;
  authorId: Types.ObjectId | { toString(): string };
  category?: string | null;
  tags?: string[] | null;
  status?: string;
  publishedAt?: Date | null;
  views?: number | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PublicAuthor {
  id: string;
  name: string;
}

function mapCore(article: CareerArticleLike) {
  return {
    id: article._id.toString(),
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt ?? '',
    content: article.content,
    featuredImage: article.featuredImage ?? '',
    category: article.category ?? '',
    tags: article.tags ?? [],
    publishedAt: article.publishedAt ?? null,
    seoTitle: article.seoTitle ?? '',
    seoDescription: article.seoDescription ?? '',
  };
}

export function mapPublicCareerArticle(
  article: CareerArticleLike,
  author?: PublicAuthor | null,
) {
  return {
    ...mapCore(article),
    views: article.views ?? 0,
    author: author
      ? { id: author.id, name: author.name }
      : { id: article.authorId.toString(), name: '' },
  };
}

export function mapPublicCareerArticleSummary(
  article: CareerArticleLike,
  author?: PublicAuthor | null,
) {
  const full = mapPublicCareerArticle(article, author);
  return {
    id: full.id,
    title: full.title,
    slug: full.slug,
    excerpt: full.excerpt,
    featuredImage: full.featuredImage,
    category: full.category,
    tags: full.tags,
    publishedAt: full.publishedAt,
    seoTitle: full.seoTitle,
    seoDescription: full.seoDescription,
    views: full.views,
    author: full.author,
  };
}

export function mapAdminCareerArticle(
  article: CareerArticleLike,
  author?: PublicAuthor | null,
) {
  return {
    ...mapPublicCareerArticle(article, author),
    status: article.status ?? 'draft',
    authorId: article.authorId.toString(),
    createdAt: article.createdAt ?? null,
    updatedAt: article.updatedAt ?? null,
  };
}
