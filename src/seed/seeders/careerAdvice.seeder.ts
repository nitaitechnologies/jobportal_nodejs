import { CareerArticle } from '../../models/CareerArticle';
import { ARTICLE_DEFS, articleBody, articleSlug } from '../data/articles';
import { daysAgo } from '../helpers/dates';
import type { SeedContext } from '../types';

export async function seedCareerAdvice(ctx: SeedContext): Promise<void> {
  if (ctx.admins.length === 0) {
    throw new Error('Admins must be seeded before career articles');
  }

  let created = 0;
  for (let i = 0; i < ARTICLE_DEFS.length; i += 1) {
    const def = ARTICLE_DEFS[i]!;
    const slug = articleSlug(def.title);
    const author = ctx.admins[i % ctx.admins.length]!;
    const publishedAt = def.status === 'published' ? daysAgo(5 + i * 2) : undefined;

    await CareerArticle.findOneAndUpdate(
      { slug },
      {
        $set: {
          title: def.title,
          slug,
          excerpt: def.excerpt,
          content: articleBody(def.title, def.excerpt),
          featuredImage: '',
          authorId: author.userId,
          category: def.category,
          tags: def.tags,
          status: def.status,
          publishedAt,
          views: def.status === 'published' ? 50 + i * 17 : 0,
          seoTitle: def.title.slice(0, 70),
          seoDescription: def.excerpt.slice(0, 160),
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    created += 1;
  }

  ctx.summary.careerArticles = created;
}
