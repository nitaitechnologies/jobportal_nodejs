import { NextFunction, Request, Response } from 'express';
import { contentBannerService } from '../services/contentBanner.service';
import { faqService } from '../services/faq.service';
import { sendSuccess } from '../utils/apiResponse';

/**
 * Public CMS content (banners + FAQs) — no auth.
 * Sheets 419 / 422.
 */
export class PublicContentController {
  async listBanners(req: Request, res: Response, next: NextFunction) {
    try {
      const placement =
        typeof req.query.placement === 'string' ? req.query.placement.trim() : undefined;
      const data = await contentBannerService.listPublic(placement || undefined);
      sendSuccess(res, data, 'Banners fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async listFaqs(req: Request, res: Response, next: NextFunction) {
    try {
      const rawCategory =
        typeof req.query.category === 'string' ? req.query.category.trim() : undefined;
      const allowed = ['general', 'candidate', 'employer', 'payments', 'safety'] as const;
      const category = allowed.includes(rawCategory as (typeof allowed)[number])
        ? (rawCategory as (typeof allowed)[number])
        : undefined;
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
      const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100;
      const data = await faqService.listPublic({
        category,
        q: q || undefined,
        limit: Number.isFinite(rawLimit) ? rawLimit : 100,
      });
      sendSuccess(res, data, 'FAQs fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const publicContentController = new PublicContentController();
