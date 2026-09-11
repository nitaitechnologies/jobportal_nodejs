import { Company } from '../models/Company';
import { Employer } from '../models/Employer';
import { User } from '../models/User';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import { mapSafeEmployerProfile } from '../utils/companyMapper';
import type { EmployerProfileUpdateInput } from '../validators/employerCompany.validator';

export class EmployerProfileService {
  async getOwnProfile(userId: string) {
    const [user, employer] = await Promise.all([
      User.findById(userId).select('name email phone role avatar status deletedAt'),
      Employer.findOne({ userId }),
    ]);

    if (!user || user.role !== 'employer' || user.deletedAt) {
      throw new AppError('Employer not found', HTTP_STATUS.NOT_FOUND);
    }

    if (user.status !== 'active') {
      throw new AppError('Employer access denied', HTTP_STATUS.FORBIDDEN);
    }

    if (!employer) {
      throw new AppError('Employer profile not found', HTTP_STATUS.NOT_FOUND);
    }

    return mapSafeEmployerProfile(user, employer);
  }

  async updateOwnProfile(userId: string, input: EmployerProfileUpdateInput) {
    const [user, employer] = await Promise.all([
      User.findById(userId).select('name email phone role avatar status deletedAt'),
      Employer.findOne({ userId }),
    ]);

    if (!user || user.role !== 'employer' || user.deletedAt) {
      throw new AppError('Employer not found', HTTP_STATUS.NOT_FOUND);
    }

    if (user.status !== 'active') {
      throw new AppError('Employer access denied', HTTP_STATUS.FORBIDDEN);
    }

    if (!employer || employer.status !== 'active') {
      throw new AppError('Employer profile not found', HTTP_STATUS.NOT_FOUND);
    }

    if (input.phone && input.phone !== user.phone) {
      const phoneOwner = await User.findOne({
        phone: input.phone,
        _id: { $ne: user._id },
      }).select('_id');

      if (phoneOwner) {
        throw new AppError('An account with this phone already exists', HTTP_STATUS.CONFLICT);
      }
    }

    if (input.name !== undefined) {
      user.name = input.name;
    }
    if (input.phone !== undefined) {
      user.phone = input.phone;
    }
    if (input.avatar !== undefined) {
      user.avatar = input.avatar;
    }
    if (input.designation !== undefined) {
      employer.designation = input.designation;
    }
    if (input.department !== undefined) {
      employer.department = input.department;
    }

    await Promise.all([user.save(), employer.save()]);

    // Ensure company association still exists (no transfer allowed via this API).
    if (employer.companyId) {
      const company = await Company.findById(employer.companyId).select('_id');
      if (!company) {
        throw new AppError('Associated company not found', HTTP_STATUS.NOT_FOUND);
      }
    }

    return mapSafeEmployerProfile(user, employer);
  }
}

export const employerProfileService = new EmployerProfileService();
