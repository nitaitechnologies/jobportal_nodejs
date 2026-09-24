import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import type { ApplicationStatus } from '../constants/enums';
import { Application } from '../models/Application';
import { Candidate } from '../models/Candidate';
import { Company } from '../models/Company';
import { Conversation } from '../models/Conversation';
import { Employer } from '../models/Employer';
import { Interview } from '../models/Interview';
import { Job } from '../models/Job';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { UserBlock } from '../models/UserBlock';
import { AppError } from '../utils/AppError';
import { parseMediaRef, toMediaRef } from '../utils/mediaMapper';
import { notifySafely } from './notification.service';
import { chatRealtime } from './chatRealtime.service';
import { readMediaBuffer } from './media.service';
import { mediaUploadService } from './mediaUpload.service';

/** Application statuses that unlock messaging between parties. */
const CHAT_ELIGIBLE_STATUSES: ApplicationStatus[] = [
  'viewed',
  'shortlisted',
  'interview',
  'hired',
];

/** Statuses that unlock phone / WhatsApp / email reveal. */
const CONTACT_REVEAL_STATUSES: ApplicationStatus[] = [
  'shortlisted',
  'interview',
  'hired',
];

type Actor = {
  userId: string;
  role: 'candidate' | 'employer';
  candidateId?: string;
  employerId?: string;
  companyId?: string;
};

function uid(id: mongoose.Types.ObjectId | string): string {
  return id.toString();
}

function mapUnread(
  unread: Map<string, number> | Record<string, number> | undefined | null,
  userId: string,
): number {
  if (!unread) return 0;
  if (unread instanceof Map) return Number(unread.get(userId) ?? 0);
  return Number((unread as Record<string, number>)[userId] ?? 0);
}

async function assertNotBlocked(a: string, b: string): Promise<void> {
  const hit = await UserBlock.findOne({
    $or: [
      { blockerId: a, blockedId: b },
      { blockerId: b, blockedId: a },
    ],
  }).lean();
  if (hit) {
    throw new AppError('Messaging is blocked between these users', HTTP_STATUS.FORBIDDEN);
  }
}

function canChatOnStatus(status: string): boolean {
  return CHAT_ELIGIBLE_STATUSES.includes(status as ApplicationStatus);
}

function canRevealContact(status: string): boolean {
  return CONTACT_REVEAL_STATUSES.includes(status as ApplicationStatus);
}

export class ChatService {
  async openOrGetForApplication(actor: Actor, applicationId: string) {
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }
    if (!canChatOnStatus(application.status)) {
      throw new AppError(
        'Chat unlocks after the employer views or shortlists the application',
        HTTP_STATUS.FORBIDDEN,
      );
    }

    const [job, candidate, employer] = await Promise.all([
      Job.findById(application.jobId).select('title companyId employerId'),
      Candidate.findById(application.candidateId).select('userId'),
      Employer.findById(application.employerId).select('userId companyId'),
    ]);
    if (!job || !candidate || !employer) {
      throw new AppError('Application parties not found', HTTP_STATUS.NOT_FOUND);
    }

    const candidateUserId = uid(candidate.userId);
    const employerUserId = uid(employer.userId);

    if (actor.role === 'candidate' && actor.userId !== candidateUserId) {
      throw new AppError('Not your application', HTTP_STATUS.FORBIDDEN);
    }
    if (actor.role === 'employer' && actor.userId !== employerUserId) {
      throw new AppError('Not your application', HTTP_STATUS.FORBIDDEN);
    }

    await assertNotBlocked(candidateUserId, employerUserId);

    let conversation = await Conversation.findOne({ applicationId: application._id });
    if (!conversation) {
      conversation = await Conversation.create({
        candidateUserId: candidate.userId,
        employerUserId: employer.userId,
        candidateId: candidate._id,
        employerId: employer._id,
        companyId: employer.companyId ?? job.companyId,
        jobId: job._id,
        applicationId: application._id,
        context: application.status === 'interview' ? 'interview' : 'application',
        unread: {
          [candidateUserId]: 0,
          [employerUserId]: 0,
        },
      });
    }

    return this.getConversationDetail(actor, uid(conversation._id));
  }

  async listConversations(actor: Actor, page: number, limit: number) {
    const filter =
      actor.role === 'candidate'
        ? { candidateUserId: actor.userId, closedAt: null }
        : { employerUserId: actor.userId, closedAt: null };

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      Conversation.find(filter)
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Conversation.countDocuments(filter),
    ]);

    const jobIds = rows.map((r) => r.jobId);
    const companyIds = rows.map((r) => r.companyId);
    const otherUserIds = rows.map((r) =>
      actor.role === 'candidate' ? r.employerUserId : r.candidateUserId,
    );

    const [jobs, companies, users] = await Promise.all([
      Job.find({ _id: { $in: jobIds } }).select('title slug').lean(),
      Company.find({ _id: { $in: companyIds } }).select('name logo slug').lean(),
      User.find({ _id: { $in: otherUserIds } }).select('name').lean(),
    ]);
    const jobMap = new Map(jobs.map((j) => [uid(j._id), j]));
    const companyMap = new Map(companies.map((c) => [uid(c._id), c]));
    const userMap = new Map(users.map((u) => [uid(u._id), u]));

    const conversations = rows.map((row) => {
      const otherId =
        actor.role === 'candidate' ? uid(row.employerUserId) : uid(row.candidateUserId);
      const job = jobMap.get(uid(row.jobId));
      const company = companyMap.get(uid(row.companyId));
      return {
        id: uid(row._id),
        applicationId: uid(row.applicationId),
        jobId: uid(row.jobId),
        jobTitle: job?.title ?? 'Job',
        jobSlug: job?.slug ?? '',
        companyName: company?.name ?? 'Company',
        companyLogo: company?.logo ?? '',
        peerName: userMap.get(otherId)?.name ?? 'User',
        peerUserId: otherId,
        context: row.context,
        lastMessageAt: row.lastMessageAt,
        lastMessagePreview: row.lastMessagePreview,
        unreadCount: mapUnread(row.unread as Map<string, number>, actor.userId),
        updatedAt: row.updatedAt,
      };
    });

    return {
      conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /** Total unread across open conversations (sheet 188 dashboard). */
  async unreadCount(actor: Actor) {
    const filter =
      actor.role === 'candidate'
        ? { candidateUserId: actor.userId, closedAt: null }
        : { employerUserId: actor.userId, closedAt: null };

    const rows = await Conversation.find(filter).select('unread').lean();
    let unreadCount = 0;
    for (const row of rows) {
      unreadCount += mapUnread(row.unread as Map<string, number> | Record<string, number>, actor.userId);
    }
    return { unreadCount };
  }

  async getConversationDetail(actor: Actor, conversationId: string) {
    const conversation = await this.requireMembership(actor, conversationId);
    const [job, company, peerUser, application, interview] = await Promise.all([
      Job.findById(conversation.jobId).select('title slug').lean(),
      Company.findById(conversation.companyId).select('name logo slug').lean(),
      User.findById(
        actor.role === 'candidate' ? conversation.employerUserId : conversation.candidateUserId,
      )
        .select('name email phone')
        .lean(),
      Application.findById(conversation.applicationId).select('status').lean(),
      conversation.interviewId
        ? Interview.findById(conversation.interviewId)
            .select('status type meetingLink scheduledAt')
            .lean()
        : null,
    ]);

    const peerUserId =
      actor.role === 'candidate'
        ? uid(conversation.employerUserId)
        : uid(conversation.candidateUserId);

    const contact = await this.buildContactChannels(
      application?.status ?? 'applied',
      peerUser,
      interview,
    );

    return {
      id: uid(conversation._id),
      applicationId: uid(conversation.applicationId),
      jobId: uid(conversation.jobId),
      jobTitle: job?.title ?? 'Job',
      companyName: company?.name ?? 'Company',
      companyLogo: company?.logo ?? '',
      peerName: peerUser?.name ?? 'User',
      peerUserId,
      context: conversation.context,
      applicationStatus: application?.status ?? null,
      unreadCount: mapUnread(conversation.unread as Map<string, number>, actor.userId),
      contact,
      interview: interview
        ? {
            id: uid(interview._id),
            status: interview.status,
            type: interview.type,
            meetingLink: interview.status === 'confirmed' ? interview.meetingLink ?? null : null,
            scheduledAt: interview.scheduledAt,
            videoCallAllowed: interview.status === 'confirmed' && Boolean(interview.meetingLink),
          }
        : null,
    };
  }

  async listMessages(actor: Actor, conversationId: string, page: number, limit: number) {
    await this.requireMembership(actor, conversationId);
    const skip = (page - 1) * limit;
    const filter = {
      conversationId,
      deletedAt: null,
    };
    const [rows, total] = await Promise.all([
      Message.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Message.countDocuments(filter),
    ]);

    return {
      messages: rows.reverse().map((m) => this.mapMessage(m, actor.userId)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async sendMessage(
    actor: Actor,
    conversationId: string,
    input: {
      body?: string;
      type?: 'text' | 'file' | 'resume_share' | 'interview_note';
      mediaRef?: string;
      fileName?: string;
      mimeType?: string;
    },
  ) {
    const conversation = await this.requireMembership(actor, conversationId);
    const peerId =
      actor.role === 'candidate'
        ? uid(conversation.employerUserId)
        : uid(conversation.candidateUserId);
    await assertNotBlocked(actor.userId, peerId);

    const type = input.type ?? 'text';
    let body = (input.body ?? '').trim();
    let mediaRef = input.mediaRef?.trim() || null;
    let fileName = input.fileName?.trim() || '';
    let mimeType = input.mimeType?.trim() || '';

    if (type === 'resume_share') {
      // Candidate shares profile resume; employer shares the application snapshot resume.
      if (actor.role === 'candidate') {
        const candidate = await Candidate.findById(conversation.candidateId).select('resume');
        if (!candidate?.resume) {
          throw new AppError('No resume on profile to share', HTTP_STATUS.BAD_REQUEST);
        }
        mediaRef = candidate.resume;
        body = body || 'Shared my resume';
      } else {
        const application = await Application.findById(conversation.applicationId).select(
          'resume',
        );
        const candidate = await Candidate.findById(conversation.candidateId).select('resume');
        const resumeRef = application?.resume?.trim() || candidate?.resume?.trim() || '';
        if (!resumeRef) {
          throw new AppError('No resume available for this application', HTTP_STATUS.BAD_REQUEST);
        }
        mediaRef = resumeRef;
        body = body || 'Shared candidate resume';
      }
      fileName = fileName || 'resume.pdf';
      mimeType = mimeType || 'application/pdf';
    }

    if ((type === 'text' || type === 'interview_note') && !body) {
      throw new AppError('Message body is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (type === 'file' && !mediaRef) {
      throw new AppError('mediaRef is required', HTTP_STATUS.BAD_REQUEST);
    }

    const message = await Message.create({
      conversationId: conversation._id,
      senderId: actor.userId,
      senderRole: actor.role,
      type,
      body,
      mediaRef,
      fileName,
      mimeType,
      readBy: [actor.userId],
    });

    const preview =
      type === 'file'
        ? `📎 ${fileName || 'File'}`
        : type === 'resume_share'
          ? '📄 Resume shared'
          : body.slice(0, 200);

    const unread = conversation.unread instanceof Map
      ? conversation.unread
      : new Map(Object.entries((conversation.unread as Record<string, number>) ?? {}));
    unread.set(peerId, (unread.get(peerId) ?? 0) + 1);
    unread.set(actor.userId, 0);
    conversation.unread = unread as typeof conversation.unread;
    conversation.lastMessageAt = message.createdAt;
    conversation.lastMessagePreview = preview;
    if (type === 'interview_note' && conversation.context !== 'interview') {
      conversation.context = 'interview';
    }
    await conversation.save();

    const mapped = this.mapMessage(message.toObject(), actor.userId);
    chatRealtime.emitToConversation(uid(conversation._id), 'chat:message', {
      conversationId: uid(conversation._id),
      message: mapped,
    });
    chatRealtime.emitToUser(peerId, 'chat:unread', {
      conversationId: uid(conversation._id),
      unreadCount: unread.get(peerId) ?? 0,
    });

    const notifType =
      type === 'file'
        ? 'CHAT_FILE'
        : type === 'resume_share'
          ? 'CHAT_RESUME_SHARE'
          : 'CHAT_MESSAGE';
    await notifySafely({
      recipientId: peerId,
      type: notifType,
      title: type === 'resume_share' ? 'Resume shared' : 'New message',
      message: preview,
      data: {
        conversationId: uid(conversation._id),
        messageId: uid(message._id),
        applicationId: uid(conversation.applicationId),
      },
    });

    return mapped;
  }

  async markRead(actor: Actor, conversationId: string) {
    const conversation = await this.requireMembership(actor, conversationId);
    await Message.updateMany(
      {
        conversationId: conversation._id,
        senderId: { $ne: actor.userId },
        readBy: { $ne: actor.userId },
        deletedAt: null,
      },
      { $addToSet: { readBy: actor.userId } },
    );

    const unread = conversation.unread instanceof Map
      ? conversation.unread
      : new Map(Object.entries((conversation.unread as Record<string, number>) ?? {}));
    unread.set(actor.userId, 0);
    conversation.unread = unread as typeof conversation.unread;

    const last = await Message.findOne({ conversationId: conversation._id, deletedAt: null })
      .sort({ createdAt: -1 })
      .select('_id')
      .lean();
    if (last) {
      const lastRead =
        conversation.lastReadMessageId instanceof Map
          ? conversation.lastReadMessageId
          : new Map(
              Object.entries(
                (conversation.lastReadMessageId as Record<string, mongoose.Types.ObjectId>) ?? {},
              ),
            );
      lastRead.set(actor.userId, last._id);
      conversation.lastReadMessageId = lastRead as typeof conversation.lastReadMessageId;
    }
    await conversation.save();

    const peerId =
      actor.role === 'candidate'
        ? uid(conversation.employerUserId)
        : uid(conversation.candidateUserId);
    chatRealtime.emitToConversation(uid(conversation._id), 'chat:read', {
      conversationId: uid(conversation._id),
      readerId: actor.userId,
      lastReadMessageId: last ? uid(last._id) : null,
    });
    chatRealtime.emitToUser(peerId, 'chat:peer_read', {
      conversationId: uid(conversation._id),
      readerId: actor.userId,
    });

    return { read: true, unreadCount: 0 };
  }

  async blockUser(actor: Actor, blockedUserId: string, reason: string) {
    if (actor.userId === blockedUserId) {
      throw new AppError('Cannot block yourself', HTTP_STATUS.BAD_REQUEST);
    }
    await UserBlock.findOneAndUpdate(
      { blockerId: actor.userId, blockedId: blockedUserId },
      { $setOnInsert: { reason: reason || '' } },
      { upsert: true, new: true },
    );
    return { blocked: true, userId: blockedUserId };
  }

  async unblockUser(actor: Actor, blockedUserId: string) {
    await UserBlock.deleteOne({ blockerId: actor.userId, blockedId: blockedUserId });
    return { unblocked: true, userId: blockedUserId };
  }

  async listBlocked(actor: Actor) {
    const rows = await UserBlock.find({ blockerId: actor.userId }).lean();
    const users = await User.find({ _id: { $in: rows.map((r) => r.blockedId) } })
      .select('name')
      .lean();
    const map = new Map(users.map((u) => [uid(u._id), u.name]));
    return {
      blocked: rows.map((r) => ({
        userId: uid(r.blockedId),
        name: map.get(uid(r.blockedId)) ?? 'User',
        reason: r.reason,
        createdAt: r.createdAt,
      })),
    };
  }

  async getContactForApplication(actor: Actor, applicationId: string) {
    const application = await Application.findById(applicationId);
    if (!application) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }

    const [candidate, employer] = await Promise.all([
      Candidate.findById(application.candidateId).select('userId'),
      Employer.findById(application.employerId).select('userId'),
    ]);
    if (!candidate || !employer) {
      throw new AppError('Application parties not found', HTTP_STATUS.NOT_FOUND);
    }

    if (actor.role === 'candidate' && actor.userId !== uid(candidate.userId)) {
      throw new AppError('Forbidden', HTTP_STATUS.FORBIDDEN);
    }
    if (actor.role === 'employer' && actor.userId !== uid(employer.userId)) {
      throw new AppError('Forbidden', HTTP_STATUS.FORBIDDEN);
    }

    const peerUserId =
      actor.role === 'candidate' ? uid(employer.userId) : uid(candidate.userId);
    await assertNotBlocked(actor.userId, peerUserId);

    const peer = await User.findById(peerUserId).select('name email phone').lean();
    const interview = await Interview.findOne({
      applicationId: application._id,
      status: { $in: ['scheduled', 'confirmed'] },
    })
      .sort({ scheduledAt: -1 })
      .select('status type meetingLink scheduledAt')
      .lean();

    return {
      applicationId,
      applicationStatus: application.status,
      peerName: peer?.name ?? 'User',
      peerUserId,
      contact: await this.buildContactChannels(application.status, peer, interview),
      interview: interview
        ? {
            id: uid(interview._id),
            status: interview.status,
            type: interview.type,
            meetingLink: interview.status === 'confirmed' ? interview.meetingLink ?? null : null,
            videoCallAllowed: interview.status === 'confirmed' && Boolean(interview.meetingLink),
          }
        : null,
    };
  }

  async linkInterviewDiscussion(interviewId: string) {
    const interview = await Interview.findById(interviewId);
    if (!interview?.applicationId) return null;
    const conversation = await Conversation.findOne({ applicationId: interview.applicationId });
    if (!conversation) return null;
    conversation.interviewId = interview._id;
    conversation.context = 'interview';
    await conversation.save();
    return conversation;
  }

  /** Upload a private chat attachment for a conversation member. */
  async uploadAttachment(
    actor: Actor,
    conversationId: string,
    file: Express.Multer.File,
  ) {
    const conversation = await this.requireMembership(actor, conversationId);
    const peerId =
      actor.role === 'candidate'
        ? uid(conversation.employerUserId)
        : uid(conversation.candidateUserId);
    await assertNotBlocked(actor.userId, peerId);

    return mediaUploadService.uploadChatAttachment(actor, conversation, file);
  }

  /** Download media attached to a message in this conversation (file / resume share). */
  async downloadAttachment(actor: Actor, conversationId: string, mediaId: string) {
    await this.requireMembership(actor, conversationId);

    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      throw new AppError('File not found', HTTP_STATUS.NOT_FOUND);
    }

    const mediaRef = toMediaRef(mediaId);
    const message = await Message.findOne({
      conversationId,
      deletedAt: null,
      $or: [{ mediaRef }, { mediaRef: mediaId }],
    }).select('_id mediaRef fileName mimeType type');

    if (!message?.mediaRef) {
      throw new AppError('File not found', HTTP_STATUS.NOT_FOUND);
    }

    const resolvedId = parseMediaRef(message.mediaRef) ?? mediaId;
    if (resolvedId !== mediaId) {
      throw new AppError('File not found', HTTP_STATUS.NOT_FOUND);
    }

    const { media, buffer } = await readMediaBuffer(mediaId);
    return {
      media,
      buffer,
      fileName: message.fileName || media.originalName || 'attachment',
    };
  }

  private async buildContactChannels(
    status: string,
    peer: { name?: string; email?: string; phone?: string } | null | undefined,
    interview: { status?: string; meetingLink?: string | null; type?: string } | null,
  ) {
    const revealed = canRevealContact(status);
    const phone = revealed ? peer?.phone?.trim() || null : null;
    const email = revealed ? peer?.email?.trim() || null : null;
    const digits = phone ? phone.replace(/\D/g, '') : '';
    const waDigits = digits.startsWith('91') ? digits : digits ? `91${digits.replace(/^0+/, '')}` : '';

    return {
      revealed,
      reason: revealed
        ? 'Contact unlocked after shortlist / interview'
        : 'Contact details unlock after shortlist or interview',
      phone: revealed ? phone : null,
      email: revealed ? email : null,
      maskedPhone: phone ? this.maskPhone(phone) : null,
      telLink: phone ? `tel:${phone}` : null,
      whatsappLink: waDigits ? `https://wa.me/${waDigits}` : null,
      allowCall: Boolean(phone),
      allowWhatsApp: Boolean(waDigits),
      allowEmail: Boolean(email),
      videoCall:
        interview?.status === 'confirmed' && interview.meetingLink
          ? {
              allowed: true,
              meetingLink: interview.meetingLink,
              type: interview.type ?? 'online',
            }
          : {
              allowed: false,
              meetingLink: null,
              type: interview?.type ?? null,
            },
    };
  }

  private maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '****';
    return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
  }

  private mapMessage(
    m: {
      _id: mongoose.Types.ObjectId;
      conversationId: mongoose.Types.ObjectId;
      senderId: mongoose.Types.ObjectId;
      senderRole: string;
      type: string;
      body?: string | null;
      mediaRef?: string | null;
      fileName?: string | null;
      mimeType?: string | null;
      readBy?: mongoose.Types.ObjectId[];
      createdAt?: Date;
    },
    viewerId: string,
  ) {
    const readBy = (m.readBy ?? []).map((id) => uid(id));
    return {
      id: uid(m._id),
      conversationId: uid(m.conversationId),
      senderId: uid(m.senderId),
      senderRole: m.senderRole,
      type: m.type,
      body: m.body ?? '',
      mediaRef: m.mediaRef ?? null,
      fileName: m.fileName ?? '',
      mimeType: m.mimeType ?? '',
      readBy,
      read: readBy.includes(viewerId) || uid(m.senderId) === viewerId,
      createdAt: m.createdAt,
    };
  }

  private async requireMembership(actor: Actor, conversationId: string) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new AppError('Conversation not found', HTTP_STATUS.NOT_FOUND);
    }
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || conversation.closedAt) {
      throw new AppError('Conversation not found', HTTP_STATUS.NOT_FOUND);
    }
    const isMember =
      (actor.role === 'candidate' && uid(conversation.candidateUserId) === actor.userId) ||
      (actor.role === 'employer' && uid(conversation.employerUserId) === actor.userId);
    if (!isMember) {
      throw new AppError('Forbidden', HTTP_STATUS.FORBIDDEN);
    }
    return conversation;
  }

  /** Admin read-only support chat inbox (sheet 448). */
  async adminListConversations(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      Conversation.find({})
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Conversation.countDocuments({}),
    ]);

    const jobIds = rows.map((r) => r.jobId);
    const companyIds = rows.map((r) => r.companyId);
    const userIds = rows.flatMap((r) => [r.candidateUserId, r.employerUserId]);
    const [jobs, companies, users] = await Promise.all([
      Job.find({ _id: { $in: jobIds } }).select('title slug').lean(),
      Company.find({ _id: { $in: companyIds } }).select('name logo slug').lean(),
      User.find({ _id: { $in: userIds } }).select('name role').lean(),
    ]);
    const jobMap = new Map(jobs.map((j) => [uid(j._id), j]));
    const companyMap = new Map(companies.map((c) => [uid(c._id), c]));
    const userMap = new Map(users.map((u) => [uid(u._id), u]));

    return {
      conversations: rows.map((row) => {
        const job = jobMap.get(uid(row.jobId));
        const company = companyMap.get(uid(row.companyId));
        const candidate = userMap.get(uid(row.candidateUserId));
        const employer = userMap.get(uid(row.employerUserId));
        return {
          id: uid(row._id),
          applicationId: uid(row.applicationId),
          jobId: uid(row.jobId),
          jobTitle: job?.title ?? 'Job',
          companyName: company?.name ?? 'Company',
          candidateName: candidate?.name ?? 'Candidate',
          employerName: employer?.name ?? 'Employer',
          context: row.context,
          lastMessageAt: row.lastMessageAt ?? null,
          lastMessagePreview: row.lastMessagePreview ?? '',
          closedAt: row.closedAt ?? null,
          updatedAt: row.updatedAt ?? null,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async adminListMessages(conversationId: string, page: number, limit: number) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new AppError('Conversation not found', HTTP_STATUS.NOT_FOUND);
    }
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new AppError('Conversation not found', HTTP_STATUS.NOT_FOUND);
    }
    const skip = (page - 1) * limit;
    const [total, rows] = await Promise.all([
      Message.countDocuments({ conversationId: conversation._id }),
      Message.find({ conversationId: conversation._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);
    return {
      conversationId: uid(conversation._id),
      messages: rows.map((m) => ({
        id: uid(m._id),
        senderId: uid(m.senderId),
        senderRole: m.senderRole ?? '',
        body: m.body ?? '',
        type: m.type ?? 'text',
        createdAt: m.createdAt ?? null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
}

export const chatService = new ChatService();
