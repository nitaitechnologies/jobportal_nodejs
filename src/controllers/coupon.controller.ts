import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { couponService } from '../services/coupon.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  CouponCreateInput,
  CouponPreviewInput,
  CouponQuery,
  CouponUpdateInput,
} from '../validators/coupon.validator';

type RequestWithValidatedQuery = Request & {
  validatedQuery?: CouponQuery;
};

function requireEmployer(req: Request) {
  if (!req.employer) {
    throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
  }
  return req.employer;
}

export class CouponController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await couponService.create(req.body as CouponCreateInput);
      sendSuccess(res, data, 'Coupon created successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as CouponQuery;
      const data = await couponService.list(query);
      sendSuccess(res, data, 'Coupons fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await couponService.getById(id);
      sendSuccess(res, data, 'Coupon fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await couponService.update(id, req.body as CouponUpdateInput);
      sendSuccess(res, data, 'Coupon updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await couponService.deactivate(id);
      sendSuccess(res, data, 'Coupon deactivated successfully');
    } catch (error) {
      next(error);
    }
  }

  async preview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireEmployer(req);
      const data = await couponService.preview(req.body as CouponPreviewInput);
      sendSuccess(res, data, 'Coupon applied to preview');
    } catch (error) {
      next(error);
    }
  }
}

export const couponController = new CouponController();
