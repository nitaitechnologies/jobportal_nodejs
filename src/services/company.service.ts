import { Company } from '../models/Company';
import { Employer } from '../models/Employer';
import { User } from '../models/User';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import {
  isCompanyPubliclyVisible,
  mapEmployerOwnedCompany,
  mapPublicCompany,
} from '../utils/companyMapper';
import type { CompanyProfileUpdateInput } from '../validators/employerCompany.validator';

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

  async getOwnedCompany(userId: string) {
    const { company } = await this.resolveOwnedCompany(userId);
    return { company: mapEmployerOwnedCompany(company) };
  }

  async updateOwnedCompany(userId: string, input: CompanyProfileUpdateInput) {
    const { company } = await this.resolveOwnedCompany(userId);

    // Name may change, but slug stays stable for public URLs.
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
    const normalized = slug.trim().toLowerCase();
    if (!normalized) {
      throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);
    }

    const company = await Company.findOne({ slug: normalized });
    if (!company || !isCompanyPubliclyVisible(company)) {
      throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);
    }

    return { company: mapPublicCompany(company) };
  }
}

export const companyService = new CompanyService();
