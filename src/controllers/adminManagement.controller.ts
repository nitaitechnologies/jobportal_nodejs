import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { adminUserService } from '../services/adminUser.service';
import { adminCandidateService } from '../services/adminCandidate.service';
import { adminEmployerService } from '../services/adminEmployer.service';
import { adminCompanyService } from '../services/adminCompany.service';
import { adminJobModerationService } from '../services/adminJobModeration.service';
import { adminOversightService } from '../services/adminOversight.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  AdminApplicationListQuery,
  AdminAuditListQuery,
  AdminCandidateListQuery,
  AdminCandidateStatusInput,
  AdminCandidateVisibilityInput,
  AdminCompanyListQuery,
  AdminCompanyStatusInput,
  AdminCompanyVerificationInput,
  AdminEmployerListQuery,
  AdminEmployerStatusInput,
  AdminInterviewListQuery,
  AdminJobListQuery,
  AdminJobStatusInput,
  AdminUserCreateInput,
  AdminUserListQuery,
  AdminUserRoleInput,
  AdminUserStatusInput,
  AdminUserUpdateInput,
} from '../validators/adminManagement.validator';

type ReqWithQuery = Request & { validatedQuery?: unknown };

function requireAdmin(req: Request) {
  if (!req.admin) throw new AppError('Admin access required', HTTP_STATUS.FORBIDDEN);
  return req.admin;
}

function idParam(req: Request): string {
  return typeof req.params.id === 'string' ? req.params.id : '';
}

export class AdminManagementController {
  // Admin users
  async listAdminUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminUserService.list(
        (req as ReqWithQuery).validatedQuery as AdminUserListQuery,
      );
      sendSuccess(res, data, 'Admin users fetched successfully');
    } catch (e) {
      next(e);
    }
  }

  async createAdminUser(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminUserService.create(
        requireAdmin(req),
        req.body as AdminUserCreateInput,
      );
      sendSuccess(res, data, 'Admin user created successfully', HTTP_STATUS.CREATED);
    } catch (e) {
      next(e);
    }
  }

  async getAdminUser(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminUserService.getById(idParam(req));
      sendSuccess(res, data, 'Admin user fetched successfully');
    } catch (e) {
      next(e);
    }
  }

  async updateAdminUser(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminUserService.update(
        requireAdmin(req),
        idParam(req),
        req.body as AdminUserUpdateInput,
      );
      sendSuccess(res, data, 'Admin user updated successfully');
    } catch (e) {
      next(e);
    }
  }

  async updateAdminUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminUserService.updateStatus(
        requireAdmin(req),
        idParam(req),
        req.body as AdminUserStatusInput,
      );
      sendSuccess(res, data, 'Admin user status updated successfully');
    } catch (e) {
      next(e);
    }
  }

  async updateAdminUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminUserService.updateRole(
        requireAdmin(req),
        idParam(req),
        req.body as AdminUserRoleInput,
      );
      sendSuccess(res, data, 'Admin user role updated successfully');
    } catch (e) {
      next(e);
    }
  }

  async deleteAdminUser(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminUserService.remove(requireAdmin(req), idParam(req));
      sendSuccess(res, data, 'Admin user deleted successfully');
    } catch (e) {
      next(e);
    }
  }

  // Candidates
  async listCandidates(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminCandidateService.list(
        (req as ReqWithQuery).validatedQuery as AdminCandidateListQuery,
      );
      sendSuccess(res, data, 'Candidates fetched successfully');
    } catch (e) {
      next(e);
    }
  }

  async getCandidate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminCandidateService.getById(idParam(req));
      sendSuccess(res, data, 'Candidate fetched successfully');
    } catch (e) {
      next(e);
    }
  }

  async updateCandidateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminCandidateService.updateStatus(
        requireAdmin(req),
        idParam(req),
        req.body as AdminCandidateStatusInput,
      );
      sendSuccess(res, data, 'Candidate status updated successfully');
    } catch (e) {
      next(e);
    }
  }

  async updateCandidateVisibility(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminCandidateService.updateVisibility(
        requireAdmin(req),
        idParam(req),
        req.body as AdminCandidateVisibilityInput,
      );
      sendSuccess(res, data, 'Candidate visibility updated successfully');
    } catch (e) {
      next(e);
    }
  }

  // Employers
  async listEmployers(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminEmployerService.list(
        (req as ReqWithQuery).validatedQuery as AdminEmployerListQuery,
      );
      sendSuccess(res, data, 'Employers fetched successfully');
    } catch (e) {
      next(e);
    }
  }

  async getEmployer(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminEmployerService.getById(idParam(req));
      sendSuccess(res, data, 'Employer fetched successfully');
    } catch (e) {
      next(e);
    }
  }

  async updateEmployerStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminEmployerService.updateStatus(
        requireAdmin(req),
        idParam(req),
        req.body as AdminEmployerStatusInput,
      );
      sendSuccess(res, data, 'Employer status updated successfully');
    } catch (e) {
      next(e);
    }
  }

  // Companies
  async listCompanies(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminCompanyService.list(
        (req as ReqWithQuery).validatedQuery as AdminCompanyListQuery,
      );
      sendSuccess(res, data, 'Companies fetched successfully');
    } catch (e) {
      next(e);
    }
  }

  async getCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminCompanyService.getById(idParam(req));
      sendSuccess(res, data, 'Company fetched successfully');
    } catch (e) {
      next(e);
    }
  }

  async updateCompanyStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminCompanyService.updateStatus(
        requireAdmin(req),
        idParam(req),
        req.body as AdminCompanyStatusInput,
      );
      sendSuccess(res, data, 'Company status updated successfully');
    } catch (e) {
      next(e);
    }
  }

  async updateCompanyVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminCompanyService.updateVerification(
        requireAdmin(req),
        idParam(req),
        req.body as AdminCompanyVerificationInput,
      );
      sendSuccess(res, data, 'Company verification updated successfully');
    } catch (e) {
      next(e);
    }
  }

  // Jobs
  async listJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminJobModerationService.list(
        (req as ReqWithQuery).validatedQuery as AdminJobListQuery,
      );
      sendSuccess(res, data, 'Jobs fetched successfully');
    } catch (e) {
      next(e);
    }
  }

  async getJob(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminJobModerationService.getById(idParam(req));
      sendSuccess(res, data, 'Job fetched successfully');
    } catch (e) {
      next(e);
    }
  }

  async updateJobStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminJobModerationService.updateStatus(
        requireAdmin(req),
        idParam(req),
        req.body as AdminJobStatusInput,
      );
      sendSuccess(res, data, 'Job status updated successfully');
    } catch (e) {
      next(e);
    }
  }

  async updateJobFeature(req: Request, res: Response, next: NextFunction) {
    try {
      const featured = Boolean((req.body as { featured: boolean }).featured);
      const data = await adminJobModerationService.updateFeatured(
        requireAdmin(req),
        idParam(req),
        featured,
      );
      sendSuccess(res, data, 'Job featured flag updated successfully');
    } catch (e) {
      next(e);
    }
  }

  async updateJobUrgent(req: Request, res: Response, next: NextFunction) {
    try {
      const urgent = Boolean((req.body as { urgent: boolean }).urgent);
      const data = await adminJobModerationService.updateUrgent(
        requireAdmin(req),
        idParam(req),
        urgent,
      );
      sendSuccess(res, data, 'Job urgent flag updated successfully');
    } catch (e) {
      next(e);
    }
  }

  // Applications / interviews / audit
  async listApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminOversightService.listApplications(
        (req as ReqWithQuery).validatedQuery as AdminApplicationListQuery,
      );
      sendSuccess(res, data, 'Applications fetched successfully');
    } catch (e) {
      next(e);
    }
  }

  async getApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminOversightService.getApplicationById(idParam(req));
      sendSuccess(res, data, 'Application fetched successfully');
    } catch (e) {
      next(e);
    }
  }

  async listInterviews(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminOversightService.listInterviews(
        (req as ReqWithQuery).validatedQuery as AdminInterviewListQuery,
      );
      sendSuccess(res, data, 'Interviews fetched successfully');
    } catch (e) {
      next(e);
    }
  }

  async getInterview(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminOversightService.getInterviewById(idParam(req));
      sendSuccess(res, data, 'Interview fetched successfully');
    } catch (e) {
      next(e);
    }
  }

  async listAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminOversightService.listAuditLogs(
        (req as ReqWithQuery).validatedQuery as AdminAuditListQuery,
      );
      sendSuccess(res, data, 'Audit logs fetched successfully');
    } catch (e) {
      next(e);
    }
  }

  async getAuditLog(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminOversightService.getAuditLogById(idParam(req));
      sendSuccess(res, data, 'Audit log fetched successfully');
    } catch (e) {
      next(e);
    }
  }
}

export const adminManagementController = new AdminManagementController();
