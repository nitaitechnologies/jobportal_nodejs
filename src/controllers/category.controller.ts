import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { categoryService } from '../services/category.service';
import { sendSuccess } from '../utils/apiResponse';
import type {
  AdminCategoryQuery,
  CategoryCreateInput,
  CategoryUpdateInput,
  PublicCategoryQuery,
} from '../validators/category.validator';

type RequestWithValidatedQuery = Request & {
  validatedQuery?: PublicCategoryQuery | AdminCategoryQuery;
};

export class CategoryController {
  async listPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as PublicCategoryQuery;
      const data = await categoryService.listPublic(query);
      sendSuccess(res, data, 'Categories fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPublicBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = typeof req.params.slug === 'string' ? req.params.slug : '';
      const data = await categoryService.getPublicBySlug(slug);
      sendSuccess(res, data, 'Category fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getSubcategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = typeof req.params.slug === 'string' ? req.params.slug : '';
      const data = await categoryService.getPublicSubcategories(slug);
      sendSuccess(res, data, 'Subcategories fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await categoryService.create(req.body as CategoryCreateInput);
      sendSuccess(res, data, 'Category created successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async listAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as AdminCategoryQuery;
      const data = await categoryService.listAdmin(query);
      sendSuccess(res, data, 'Admin categories fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAdminById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await categoryService.getAdminById(id);
      sendSuccess(res, data, 'Category fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await categoryService.update(id, req.body as CategoryUpdateInput);
      sendSuccess(res, data, 'Category updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await categoryService.remove(id);
      const message = data.deactivated
        ? 'Category deactivated because it has dependencies'
        : 'Category deleted successfully';
      sendSuccess(res, data, message);
    } catch (error) {
      next(error);
    }
  }
}

export const categoryController = new CategoryController();
