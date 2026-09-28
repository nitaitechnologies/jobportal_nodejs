import mongoose from 'mongoose';
import { z } from 'zod';
import { HTTP_STATUS } from '../constants';
import { Application } from '../models/Application';
import { Employer } from '../models/Employer';
import { Job } from '../models/Job';
import { User } from '../models/User';
import type { AuthenticatedEmployer } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { mapEmployerApplication } from '../utils/applicationMapper';
import { mapEmployerJob } from '../utils/jobMapper';
import { recordCompanyActivity } from './companyActivity.service';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export const assignJobAssigneesSchema = z
  .object({
    employerIds: z.array(objectIdSchema).max(20).default([]),
  })
  .strict();

export const assignApplicationSchema = z
  .object({
    employerId: objectIdSchema.nullable(),
  })
  .strict();

export type AssignJobAssigneesInput = z.infer<typeof assignJobAssigneesSchema>;
export type AssignApplicationInput = z.infer<typeof assignApplicationSchema>;

async function resolveActorName(employer: AuthenticatedEmployer): Promise<string> {
  const doc = await Employer.findById(employer.employerId).select('userId');
  if (!doc) return 'Hiring team';
  const user = await User.findById(doc.userId).select('name');
  return user?.name?.trim() || 'Hiring team';
}

async function assertCompanyMembers(companyId: string, employerIds: string[]) {
  if (employerIds.length === 0) return;
  const members = await Employer.find({
    _id: { $in: employerIds.map((id) => new mongoose.Types.ObjectId(id)) },
    companyId: new mongoose.Types.ObjectId(companyId),
    status: 'active',
  }).select('_id');
  if (members.length !== employerIds.length) {
    throw new AppError(
      'One or more assignees are not active members of this company',
      HTTP_STATUS.BAD_REQUEST,
    );
  }
}

async function memberSummaries(employerIds: string[]) {
  if (employerIds.length === 0) return [] as Array<{ id: string; name: string }>;
  const members = await Employer.find({
    _id: { $in: employerIds.map((id) => new mongoose.Types.ObjectId(id)) },
  }).select('_id userId');
  const users = await User.find({
    _id: { $in: members.map((m) => m.userId) },
  }).select('name');
  const userMap = new Map(users.map((u) => [u._id.toString(), u.name ?? '']));
  return members.map((m) => ({
    id: m._id.toString(),
    name: userMap.get(m.userId.toString())?.trim() || 'Recruiter',
  }));
}

export class EmployerAssignmentService {
  async assignJob(
    employer: AuthenticatedEmployer,
    jobId: string,
    input: AssignJobAssigneesInput,
  ) {
    const job = await Job.findOne({
      _id: jobId,
      companyId: employer.companyId,
      deletedAt: null,
    });
    if (!job) {
      throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
    }

    const uniqueIds = [...new Set(input.employerIds)];
    await assertCompanyMembers(employer.companyId, uniqueIds);
    job.set(
      'assignedEmployerIds',
      uniqueIds.map((id) => new mongoose.Types.ObjectId(id)),
    );
    await job.save();

    const assignees = await memberSummaries(uniqueIds);
    const actorName = await resolveActorName(employer);
    await recordCompanyActivity({
      companyId: employer.companyId,
      actorEmployerId: employer.employerId,
      actorName,
      action: 'job.assigned',
      entityType: 'job',
      entityId: job._id.toString(),
      summary:
        uniqueIds.length === 0
          ? `Cleared assignees on “${job.title}”`
          : `Assigned ${assignees.map((a) => a.name).join(', ')} to “${job.title}”`,
      metadata: { employerIds: uniqueIds },
    });

    return {
      job: {
        ...mapEmployerJob(job),
        assignedEmployerIds: uniqueIds,
        assignees,
      },
    };
  }

  async assignApplication(
    employer: AuthenticatedEmployer,
    applicationId: string,
    input: AssignApplicationInput,
  ) {
    const application = await Application.findOne({
      _id: applicationId,
      companyId: employer.companyId,
    });
    if (!application) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }

    if (input.employerId) {
      await assertCompanyMembers(employer.companyId, [input.employerId]);
      application.set(
        'assignedEmployerId',
        new mongoose.Types.ObjectId(input.employerId),
      );
    } else {
      application.set('assignedEmployerId', null);
    }
    await application.save();

    const assignee =
      input.employerId == null
        ? null
        : (await memberSummaries([input.employerId]))[0] ?? null;
    const actorName = await resolveActorName(employer);
    await recordCompanyActivity({
      companyId: employer.companyId,
      actorEmployerId: employer.employerId,
      actorName,
      action: 'application.assigned',
      entityType: 'application',
      entityId: application._id.toString(),
      summary: assignee
        ? `Assigned application to ${assignee.name}`
        : 'Cleared application assignee',
      metadata: { employerId: input.employerId },
    });

    return {
      application: {
        ...mapEmployerApplication(application),
        assignedEmployerId: input.employerId,
        assignee,
      },
    };
  }
}

export const employerAssignmentService = new EmployerAssignmentService();
