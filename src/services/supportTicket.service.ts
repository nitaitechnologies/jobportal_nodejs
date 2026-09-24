import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import {
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_STATUSES,
} from '../constants/enums';
import { SupportTicket } from '../models/SupportTicket';
import { Report } from '../models/Report';
import { AdminUser } from '../models/AdminUser';
import type { AuthenticatedAdmin, AuthenticatedIdentity } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { writeAuditSafely } from './audit.service';
import type {
  SupportTicketCreateInput,
  SupportTicketQuery,
  SupportTicketUpdateInput,
} from '../validators/supportTicket.validator';

function mapTicket(doc: {
  _id: { toString(): string };
  userId?: { toString(): string } | null;
  role?: string | null;
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
  status?: string;
  reportId?: { toString(): string } | null;
  assignedTo?: { toString(): string } | null;
  resolution?: string | null;
  resolvedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    userId: doc.userId ? doc.userId.toString() : null,
    role: doc.role ?? 'guest',
    name: doc.name,
    email: doc.email,
    subject: doc.subject,
    category: doc.category,
    message: doc.message,
    status: doc.status ?? 'open',
    reportId: doc.reportId ? doc.reportId.toString() : null,
    assignedTo: doc.assignedTo ? doc.assignedTo.toString() : null,
    resolution: doc.resolution ?? '',
    resolvedAt: doc.resolvedAt ?? null,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

function categoryToReportReason(
  category: SupportTicketCreateInput['category'],
): 'technical_issue' | 'account_help' | 'billing_help' | 'other' {
  if (category === 'technical-issue') return 'technical_issue';
  if (category === 'billing') return 'billing_help';
  if (category === 'candidate-support' || category === 'employer-support') {
    return 'account_help';
  }
  return 'other';
}

export class SupportTicketService {
  listCategories() {
    return {
      categories: SUPPORT_TICKET_CATEGORIES.map((value) => ({
        value,
        label: value
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
      })),
      statuses: SUPPORT_TICKET_STATUSES.map((value) => ({ value, label: value })),
    };
  }

  async create(input: SupportTicketCreateInput, user?: AuthenticatedIdentity | null) {
    if (!SUPPORT_TICKET_CATEGORIES.includes(input.category)) {
      throw new AppError('Invalid support category', HTTP_STATUS.BAD_REQUEST, [
        { path: 'category', message: 'Unknown category' },
      ]);
    }

    let reportId: mongoose.Types.ObjectId | null = null;
    if (user && (input.category === 'technical-issue' || input.category === 'other')) {
      try {
        const report = await Report.create({
          reporterId: new mongoose.Types.ObjectId(user.userId),
          targetType: 'platform',
          targetId: new mongoose.Types.ObjectId(user.userId),
          reason: categoryToReportReason(input.category),
          description: `${input.subject}\n\n${input.message}`.slice(0, 5000),
          status: 'pending',
        });
        reportId = report._id as mongoose.Types.ObjectId;
      } catch {
        // Unique active report may already exist — ticket still created.
      }
    }

    const ticket = await SupportTicket.create({
      userId: user?.userId ? new mongoose.Types.ObjectId(user.userId) : null,
      role: user?.role === 'candidate' || user?.role === 'employer' ? user.role : 'guest',
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      subject: input.subject.trim(),
      category: input.category,
      message: input.message.trim(),
      status: 'open',
      reportId,
    });

    return { ticket: mapTicket(ticket) };
  }

  async listMine(userId: string, query: { page: number; limit: number }) {
    const filter = { userId: new mongoose.Types.ObjectId(userId) };
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      SupportTicket.countDocuments(filter),
      SupportTicket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    ]);
    return {
      tickets: rows.map((row) => mapTicket(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async adminList(query: SupportTicketQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.assignedTo) filter.assignedTo = new mongoose.Types.ObjectId(query.assignedTo);
    if (query.q?.trim()) {
      const rx = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { subject: { $regex: rx, $options: 'i' } },
        { email: { $regex: rx, $options: 'i' } },
        { name: { $regex: rx, $options: 'i' } },
      ];
    }
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      SupportTicket.countDocuments(filter),
      SupportTicket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    ]);
    return {
      tickets: rows.map((row) => mapTicket(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async adminGet(id: string) {
    const ticket = await SupportTicket.findById(id);
    if (!ticket) throw new AppError('Support ticket not found', HTTP_STATUS.NOT_FOUND);
    return { ticket: mapTicket(ticket) };
  }

  async adminUpdate(admin: AuthenticatedAdmin, id: string, input: SupportTicketUpdateInput) {
    const ticket = await SupportTicket.findById(id);
    if (!ticket) throw new AppError('Support ticket not found', HTTP_STATUS.NOT_FOUND);

    const previous = {
      status: ticket.status,
      assignedTo: ticket.assignedTo ? ticket.assignedTo.toString() : null,
    };

    if (input.category !== undefined) ticket.category = input.category;
    if (input.resolution !== undefined) ticket.resolution = input.resolution.trim();

    if (input.assignedTo !== undefined) {
      if (input.assignedTo === null) {
        ticket.assignedTo = null;
      } else {
        const assignee = await AdminUser.findById(input.assignedTo).select('_id status');
        if (!assignee || assignee.status !== 'active') {
          throw new AppError('Assignee admin not found or inactive', HTTP_STATUS.BAD_REQUEST);
        }
        ticket.assignedTo = assignee._id as mongoose.Types.ObjectId;
        if (ticket.status === 'open') ticket.status = 'in_progress';
      }
    }

    if (input.status !== undefined) {
      ticket.status = input.status;
      if (input.status === 'resolved' || input.status === 'closed') {
        ticket.resolvedAt = ticket.resolvedAt ?? new Date();
      }
      if (input.status === 'open' || input.status === 'in_progress') {
        ticket.resolvedAt = null;
      }
    }

    await ticket.save();

    await writeAuditSafely({
      admin,
      action: 'support_ticket_updated',
      entityType: 'support_ticket',
      entityId: ticket._id.toString(),
      metadata: {
        from: previous,
        to: {
          status: ticket.status,
          assignedTo: ticket.assignedTo ? ticket.assignedTo.toString() : null,
        },
      },
    });

    return { ticket: mapTicket(ticket) };
  }
}

export const supportTicketService = new SupportTicketService();
