import type { ArticleStatus } from '../constants/enums';

const TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  draft: ['published', 'archived'],
  published: ['draft', 'archived'],
  archived: ['draft'],
};

export function canTransitionArticleStatus(
  from: ArticleStatus,
  to: ArticleStatus,
): boolean {
  if (from === to) {
    return true;
  }
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function canPublishArticle(status: ArticleStatus): boolean {
  return status === 'draft' || status === 'published';
}

export function canUnpublishArticle(status: ArticleStatus): boolean {
  return status === 'published' || status === 'draft';
}

export function canArchiveArticle(status: ArticleStatus): boolean {
  return status === 'draft' || status === 'published' || status === 'archived';
}
