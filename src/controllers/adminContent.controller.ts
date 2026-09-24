import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { taxonomyService } from '../services/taxonomy.service';
import { contentBannerService } from '../services/contentBanner.service';
import { faqService } from '../services/faq.service';
import { adminNotificationService } from '../services/adminNotification.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  TaxonomyCreateInput,
  TaxonomyQuery,
  TaxonomyUpdateInput,
} from '../validators/taxonomy.validator';
import type {
  BannerCreateInput,
  BannerQuery,
  BannerUpdateInput,
} from '../validators/contentBanner.validator';
import type { FaqCreateInput, FaqQuery, FaqUpdateInput } from '../validators/faq.validator';
import type {
  AdminNotificationQuery,
  AdminNotificationSendInput,
  NotificationTemplateCreateInput,
  NotificationTemplateQuery,
  NotificationTemplateUpdateInput,
} from '../validators/adminNotification.validator';
import type { AuthenticatedAdmin } from '../types/auth.types';

type ReqQ<T> = Request & { validatedQuery?: T };

function requireAdmin(req: Request): AuthenticatedAdmin {
  if (!req.admin) throw new AppError('Admin access required', HTTP_STATUS.FORBIDDEN);
  return req.admin;
}

function idParam(req: Request): string {
  return typeof req.params.id === 'string' ? req.params.id : '';
}

export class AdminContentController {
  // Taxonomy
  async listTaxonomy(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await taxonomyService.list((req as ReqQ<TaxonomyQuery>).validatedQuery!);
      sendSuccess(res, data, 'Taxonomy terms fetched successfully');
    } catch (e) {
      next(e);
    }
  }
  async getTaxonomy(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await taxonomyService.getById(idParam(req)), 'Taxonomy term fetched');
    } catch (e) {
      next(e);
    }
  }
  async createTaxonomy(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await taxonomyService.create(req.body as TaxonomyCreateInput);
      sendSuccess(res, data, 'Taxonomy term created', HTTP_STATUS.CREATED);
    } catch (e) {
      next(e);
    }
  }
  async updateTaxonomy(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await taxonomyService.update(idParam(req), req.body as TaxonomyUpdateInput);
      sendSuccess(res, data, 'Taxonomy term updated');
    } catch (e) {
      next(e);
    }
  }
  async deleteTaxonomy(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await taxonomyService.remove(idParam(req)), 'Taxonomy term deleted');
    } catch (e) {
      next(e);
    }
  }

  // Banners
  async listBanners(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await contentBannerService.list((req as ReqQ<BannerQuery>).validatedQuery!);
      sendSuccess(res, data, 'Banners fetched successfully');
    } catch (e) {
      next(e);
    }
  }
  async getBanner(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await contentBannerService.getById(idParam(req)), 'Banner fetched');
    } catch (e) {
      next(e);
    }
  }
  async createBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await contentBannerService.create(req.body as BannerCreateInput);
      sendSuccess(res, data, 'Banner created', HTTP_STATUS.CREATED);
    } catch (e) {
      next(e);
    }
  }
  async updateBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await contentBannerService.update(idParam(req), req.body as BannerUpdateInput);
      sendSuccess(res, data, 'Banner updated');
    } catch (e) {
      next(e);
    }
  }
  async deleteBanner(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await contentBannerService.remove(idParam(req)), 'Banner deleted');
    } catch (e) {
      next(e);
    }
  }

  // FAQ
  async listFaqs(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await faqService.list((req as ReqQ<FaqQuery>).validatedQuery!);
      sendSuccess(res, data, 'FAQs fetched successfully');
    } catch (e) {
      next(e);
    }
  }
  async getFaq(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await faqService.getById(idParam(req)), 'FAQ fetched');
    } catch (e) {
      next(e);
    }
  }
  async createFaq(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await faqService.create(req.body as FaqCreateInput);
      sendSuccess(res, data, 'FAQ created', HTTP_STATUS.CREATED);
    } catch (e) {
      next(e);
    }
  }
  async updateFaq(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await faqService.update(idParam(req), req.body as FaqUpdateInput);
      sendSuccess(res, data, 'FAQ updated');
    } catch (e) {
      next(e);
    }
  }
  async deleteFaq(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await faqService.remove(idParam(req)), 'FAQ deleted');
    } catch (e) {
      next(e);
    }
  }

  // Notifications
  async listNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminNotificationService.listHistory(
        (req as ReqQ<AdminNotificationQuery>).validatedQuery!,
      );
      sendSuccess(res, data, 'Notification history fetched');
    } catch (e) {
      next(e);
    }
  }
  async sendNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminNotificationService.send(
        requireAdmin(req),
        req.body as AdminNotificationSendInput,
      );
      sendSuccess(res, data, 'Notifications queued/sent', HTTP_STATUS.CREATED);
    } catch (e) {
      next(e);
    }
  }
  async listTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminNotificationService.listTemplates(
        (req as ReqQ<NotificationTemplateQuery>).validatedQuery!,
      );
      sendSuccess(res, data, 'Templates fetched');
    } catch (e) {
      next(e);
    }
  }
  async createTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminNotificationService.createTemplate(
        req.body as NotificationTemplateCreateInput,
      );
      sendSuccess(res, data, 'Template created', HTTP_STATUS.CREATED);
    } catch (e) {
      next(e);
    }
  }
  async updateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminNotificationService.updateTemplate(
        idParam(req),
        req.body as NotificationTemplateUpdateInput,
      );
      sendSuccess(res, data, 'Template updated');
    } catch (e) {
      next(e);
    }
  }
  async deleteTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(
        res,
        await adminNotificationService.deleteTemplate(idParam(req)),
        'Template deleted',
      );
    } catch (e) {
      next(e);
    }
  }
}

export const adminContentController = new AdminContentController();
