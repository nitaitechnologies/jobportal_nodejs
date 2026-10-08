import mongoose from 'mongoose';
import { env } from '../config/env';
import { HTTP_STATUS } from '../constants';
import type { EmployerTeamRole } from '../constants/enums';
import { permissionsForTeamRole } from '../constants/employerPermissions';
import { Company } from '../models/Company';
import { Employer } from '../models/Employer';
import { EmployerTeamInvite } from '../models/EmployerTeamInvite';
import { User } from '../models/User';
import type { AuthenticatedEmployer } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { hashPassword } from '../utils/password';
import { isValidPhone, normalizePhone } from '../utils/phone';
import { authSessionService } from './authSession.service';
import { recordCompanyActivity } from './companyActivity.service';
import { getFeatureFlags } from '../utils/featureFlags';

function designationForRole(role: EmployerTeamRole): string {
  if (role === 'owner') return 'Owner';
  if (role === 'hr') return 'HR';
  return 'Recruiter';
}

async function resolveActorName(employer: AuthenticatedEmployer): Promise<string> {
  const doc = await Employer.findById(employer.employerId).select('userId');
  if (!doc) return 'Hiring team';
  const user = await User.findById(doc.userId).select('name');
  return user?.name?.trim() || 'Hiring team';
}

export class EmployerTeamService {
  async listMembers(employer: AuthenticatedEmployer) {
    const members = await Employer.find({
      companyId: new mongoose.Types.ObjectId(employer.companyId),
      status: 'active',
    }).sort({ createdAt: 1 });

    const userIds = members.map((item) => item.userId);
    const users = await User.find({ _id: { $in: userIds } }).select(
      'name email phone phoneVerified emailVerified status',
    );
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));

    return {
      members: members.map((item) => {
        const user = userMap.get(item.userId.toString());
        const teamRole = (item.teamRole as EmployerTeamRole) || 'recruiter';
        return {
          id: item._id.toString(),
          userId: item.userId.toString(),
          name: user?.name ?? '',
          email: user?.email ?? '',
          phone: user?.phone ?? '',
          teamRole,
          designation: item.designation || designationForRole(teamRole),
          department: item.department || '',
          permissions: permissionsForTeamRole(teamRole),
          verified: Boolean(item.verified),
          phoneVerified: Boolean(user?.phoneVerified),
          emailVerified: Boolean(user?.emailVerified),
          isYou: item._id.toString() === employer.employerId,
          createdAt: item.createdAt,
        };
      }),
    };
  }

  async listInvites(employer: AuthenticatedEmployer) {
    const invites = await EmployerTeamInvite.find({
      companyId: new mongoose.Types.ObjectId(employer.companyId),
      status: 'pending',
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    return {
      invites: invites.map((invite) => ({
        id: invite._id.toString(),
        email: invite.email,
        name: invite.name || '',
        teamRole: invite.teamRole,
        department: invite.department || '',
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        token: invite.token,
      })),
    };
  }

  async invite(
    employer: AuthenticatedEmployer,
    input: { email: string; name?: string; teamRole: 'hr' | 'recruiter'; department?: string },
  ) {
    const email = input.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError('Valid email is required', HTTP_STATUS.BAD_REQUEST);
    }

    const existingUser = await User.findOne({ email }).select('_id role');
    if (existingUser) {
      const existingEmployer = await Employer.findOne({ userId: existingUser._id });
      if (existingEmployer?.companyId?.toString() === employer.companyId) {
        throw new AppError('This person is already on your team', HTTP_STATUS.CONFLICT);
      }
      throw new AppError(
        'An account with this email already exists. Ask them to use a different email.',
        HTTP_STATUS.CONFLICT,
      );
    }

    const pending = await EmployerTeamInvite.findOne({
      companyId: employer.companyId,
      email,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });
    if (pending) {
      throw new AppError('An invite is already pending for this email', HTTP_STATUS.CONFLICT);
    }

    const expiresAt = new Date(
      Date.now() + env.employerTeamInviteTtlDays * 24 * 60 * 60 * 1000,
    );
    const invite = await EmployerTeamInvite.create({
      companyId: employer.companyId,
      invitedByEmployerId: employer.employerId,
      email,
      name: (input.name ?? '').trim(),
      teamRole: input.teamRole,
      department: (input.department ?? '').trim(),
      expiresAt,
      status: 'pending',
    });

    const actorName = await resolveActorName(employer);
    await recordCompanyActivity({
      companyId: employer.companyId,
      actorEmployerId: employer.employerId,
      actorName,
      action: 'team.invite',
      entityType: 'invite',
      entityId: invite._id.toString(),
      summary: `Invited ${email} as ${input.teamRole}${input.department?.trim() ? ` (${input.department.trim()})` : ''}`,
      metadata: { email, teamRole: input.teamRole, department: (input.department ?? '').trim() },
    });

    return {
      invite: {
        id: invite._id.toString(),
        email: invite.email,
        name: invite.name || '',
        teamRole: invite.teamRole,
        department: invite.department || '',
        expiresAt: invite.expiresAt,
        token: invite.token,
        acceptPath: `/employer/team/accept?token=${invite.token}`,
      },
    };
  }

  async revokeInvite(employer: AuthenticatedEmployer, inviteId: string) {
    if (!mongoose.Types.ObjectId.isValid(inviteId)) {
      throw new AppError('Invite not found', HTTP_STATUS.NOT_FOUND);
    }
    const invite = await EmployerTeamInvite.findOne({
      _id: inviteId,
      companyId: employer.companyId,
      status: 'pending',
    });
    if (!invite) {
      throw new AppError('Invite not found', HTTP_STATUS.NOT_FOUND);
    }
    invite.status = 'revoked';
    await invite.save();

    const actorName = await resolveActorName(employer);
    await recordCompanyActivity({
      companyId: employer.companyId,
      actorEmployerId: employer.employerId,
      actorName,
      action: 'team.invite_revoked',
      entityType: 'invite',
      entityId: invite._id.toString(),
      summary: `Revoked invite for ${invite.email}`,
      metadata: { email: invite.email },
    });

    return { revoked: true };
  }

  async acceptInvite(
    input: {
      token: string;
      name: string;
      phone: string;
      password: string;
    },
    meta?: { userAgent?: string; ip?: string },
  ) {
    const invite = await EmployerTeamInvite.findOne({ token: input.token.trim() });
    if (!invite || invite.status !== 'pending') {
      throw new AppError('Invite is invalid or already used', HTTP_STATUS.BAD_REQUEST);
    }
    if (invite.expiresAt.getTime() <= Date.now()) {
      invite.status = 'expired';
      await invite.save();
      throw new AppError('Invite has expired. Ask your admin for a new invite.', HTTP_STATUS.BAD_REQUEST);
    }

    const phone = normalizePhone(input.phone);
    if (!isValidPhone(phone)) {
      throw new AppError('Phone must be a valid 10-digit mobile number', HTTP_STATUS.BAD_REQUEST);
    }

    const existingEmail = await User.findOne({ email: invite.email }).select('_id');
    if (existingEmail) {
      throw new AppError('An account with this email already exists', HTTP_STATUS.CONFLICT);
    }
    const existingPhone = await User.findOne({ phone }).select('_id');
    if (existingPhone) {
      throw new AppError('An account with this phone already exists', HTTP_STATUS.CONFLICT);
    }

    const company = await Company.findById(invite.companyId);
    if (!company || company.status === 'suspended') {
      throw new AppError('Company is not available', HTTP_STATUS.FORBIDDEN);
    }

    const passwordHash = await hashPassword(input.password);
    const teamRole = invite.teamRole as EmployerTeamRole;

    const user = await User.create({
      name: input.name.trim(),
      email: invite.email,
      phone,
      passwordHash,
      role: 'employer',
      status: 'active',
    });

    const member = await Employer.create({
      userId: user._id,
      companyId: company._id,
      teamRole,
      designation: designationForRole(teamRole),
      department: invite.department || '',
      verified: false,
      status: 'active',
    });

    invite.status = 'accepted';
    invite.acceptedAt = new Date();
    invite.acceptedEmployerId = member._id;
    await invite.save();

    await recordCompanyActivity({
      companyId: company._id.toString(),
      actorEmployerId: member._id.toString(),
      actorName: user.name?.trim() || invite.email,
      action: 'team.joined',
      entityType: 'team',
      entityId: member._id.toString(),
      summary: `${user.name?.trim() || invite.email} joined as ${teamRole}`,
      metadata: { teamRole, email: invite.email },
    });

    const { accessToken, sessionId } = await authSessionService.createAccessToken(
      user._id.toString(),
      'employer',
      {
        deviceLabel: 'Invite accept',
        userAgent: meta?.userAgent,
        ip: meta?.ip,
      },
      { maxSessions: env.employerMaxSessions },
    );

    return {
      accessToken,
      sessionId,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: 'employer' as const,
        phoneVerified: Boolean(user.phoneVerified),
        emailVerified: Boolean(user.emailVerified),
      },
      employer: {
        id: member._id.toString(),
        companyId: company._id.toString(),
        teamRole,
        designation: member.designation,
        department: member.department || '',
        permissions: permissionsForTeamRole(teamRole),
        verified: false,
      },
      company: {
        id: company._id.toString(),
        name: company.name,
        slug: company.slug,
        verificationStatus: company.verificationStatus,
        status: company.status,
      },
      features: await getFeatureFlags(),
    };
  }

  async updateMemberRole(
    employer: AuthenticatedEmployer,
    memberId: string,
    teamRole: 'hr' | 'recruiter',
  ) {
    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      throw new AppError('Team member not found', HTTP_STATUS.NOT_FOUND);
    }
    if (memberId === employer.employerId) {
      throw new AppError('You cannot change your own role', HTTP_STATUS.BAD_REQUEST);
    }

    const member = await Employer.findOne({
      _id: memberId,
      companyId: employer.companyId,
      status: 'active',
    });
    if (!member) {
      throw new AppError('Team member not found', HTTP_STATUS.NOT_FOUND);
    }
    if (member.teamRole === 'owner') {
      throw new AppError('Cannot change the owner role', HTTP_STATUS.FORBIDDEN);
    }

    const previousRole = member.teamRole;
    member.teamRole = teamRole;
    member.designation = designationForRole(teamRole);
    await member.save();

    const actorName = await resolveActorName(employer);
    const memberUser = await User.findById(member.userId).select('name email');
    await recordCompanyActivity({
      companyId: employer.companyId,
      actorEmployerId: employer.employerId,
      actorName,
      action: 'team.role_changed',
      entityType: 'team',
      entityId: member._id.toString(),
      summary: `Changed ${memberUser?.name?.trim() || memberUser?.email || 'member'} from ${previousRole} to ${teamRole}`,
      metadata: { previousRole, teamRole, memberId },
    });

    return {
      member: {
        id: member._id.toString(),
        teamRole,
        designation: member.designation,
        permissions: permissionsForTeamRole(teamRole),
      },
    };
  }

  async removeMember(employer: AuthenticatedEmployer, memberId: string) {
    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      throw new AppError('Team member not found', HTTP_STATUS.NOT_FOUND);
    }
    if (memberId === employer.employerId) {
      throw new AppError('You cannot remove yourself', HTTP_STATUS.BAD_REQUEST);
    }

    const member = await Employer.findOne({
      _id: memberId,
      companyId: employer.companyId,
      status: 'active',
    });
    if (!member) {
      throw new AppError('Team member not found', HTTP_STATUS.NOT_FOUND);
    }
    if (member.teamRole === 'owner') {
      throw new AppError('Cannot remove the company owner', HTTP_STATUS.FORBIDDEN);
    }

    const memberUser = await User.findById(member.userId).select('name email');
    member.status = 'inactive';
    await member.save();
    await authSessionService.revokeOthers(member.userId.toString());

    const actorName = await resolveActorName(employer);
    await recordCompanyActivity({
      companyId: employer.companyId,
      actorEmployerId: employer.employerId,
      actorName,
      action: 'team.member_removed',
      entityType: 'team',
      entityId: member._id.toString(),
      summary: `Removed ${memberUser?.name?.trim() || memberUser?.email || 'member'} from the team`,
      metadata: { memberId, teamRole: member.teamRole },
    });

    return { removed: true };
  }

  async updateMemberDepartment(
    employer: AuthenticatedEmployer,
    memberId: string,
    department: string,
  ) {
    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      throw new AppError('Team member not found', HTTP_STATUS.NOT_FOUND);
    }

    const member = await Employer.findOne({
      _id: memberId,
      companyId: employer.companyId,
      status: 'active',
    });
    if (!member) {
      throw new AppError('Team member not found', HTTP_STATUS.NOT_FOUND);
    }

    member.department = department.trim();
    await member.save();

    return {
      member: {
        id: member._id.toString(),
        teamRole: member.teamRole,
        designation: member.designation || '',
        department: member.department || '',
      },
    };
  }
}

export const employerTeamService = new EmployerTeamService();
