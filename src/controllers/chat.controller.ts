import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { chatService } from '../services/chat.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  ChatBlockBody,
  ChatConversationListQuery,
  ChatMessagesQuery,
  ChatOpenBody,
  ChatSendBody,
} from '../validators/chat.validator';

type RequestWithQuery<T> = Request & { validatedQuery?: T };

function actorFromRequest(req: Request) {
  if (req.candidate) {
    return {
      userId: req.candidate.userId,
      role: 'candidate' as const,
      candidateId: req.candidate.candidateId,
    };
  }
  if (req.employer) {
    return {
      userId: req.employer.userId,
      role: 'employer' as const,
      employerId: req.employer.employerId,
      companyId: req.employer.companyId,
    };
  }
  throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
}

export class ChatController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithQuery<ChatConversationListQuery>).validatedQuery!;
      const data = await chatService.listConversations(actorFromRequest(req), query.page, query.limit);
      sendSuccess(res, data, 'Conversations fetched');
    } catch (error) {
      next(error);
    }
  }

  async unreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await chatService.unreadCount(actorFromRequest(req));
      sendSuccess(res, data, 'Unread message count fetched');
    } catch (error) {
      next(error);
    }
  }

  async open(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as ChatOpenBody;
      const data = await chatService.openOrGetForApplication(
        actorFromRequest(req),
        body.applicationId,
      );
      sendSuccess(res, data, 'Conversation ready');
    } catch (error) {
      next(error);
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await chatService.getConversationDetail(
        actorFromRequest(req),
        String(req.params.id),
      );
      sendSuccess(res, data, 'Conversation fetched');
    } catch (error) {
      next(error);
    }
  }

  async listMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithQuery<ChatMessagesQuery>).validatedQuery!;
      const data = await chatService.listMessages(
        actorFromRequest(req),
        String(req.params.id),
        query.page,
        query.limit,
      );
      sendSuccess(res, data, 'Messages fetched');
    } catch (error) {
      next(error);
    }
  }

  async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as ChatSendBody;
      const data = await chatService.sendMessage(actorFromRequest(req), String(req.params.id), body);
      sendSuccess(res, data, 'Message sent', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await chatService.markRead(actorFromRequest(req), String(req.params.id));
      sendSuccess(res, data, 'Marked as read');
    } catch (error) {
      next(error);
    }
  }

  async block(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as ChatBlockBody;
      const data = await chatService.blockUser(actorFromRequest(req), body.userId, body.reason);
      sendSuccess(res, data, 'User blocked');
    } catch (error) {
      next(error);
    }
  }

  async unblock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await chatService.unblockUser(actorFromRequest(req), String(req.params.userId));
      sendSuccess(res, data, 'User unblocked');
    } catch (error) {
      next(error);
    }
  }

  async listBlocked(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await chatService.listBlocked(actorFromRequest(req));
      sendSuccess(res, data, 'Blocked users fetched');
    } catch (error) {
      next(error);
    }
  }

  async contact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithQuery<{ applicationId: string }>).validatedQuery!;
      const data = await chatService.getContactForApplication(
        actorFromRequest(req),
        query.applicationId,
      );
      sendSuccess(res, data, 'Contact channels fetched');
    } catch (error) {
      next(error);
    }
  }

  async uploadAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError('File is required', HTTP_STATUS.BAD_REQUEST);
      }
      const data = await chatService.uploadAttachment(
        actorFromRequest(req),
        String(req.params.id),
        req.file,
      );
      sendSuccess(res, data, 'Attachment uploaded', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async downloadAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { media, buffer, fileName } = await chatService.downloadAttachment(
        actorFromRequest(req),
        String(req.params.id),
        String(req.params.mediaId),
      );
      const safeName = (fileName || media.originalName || 'attachment')
        .replace(/[^\w.\- ()[\]]+/g, '_')
        .replace(/"/g, '')
        .slice(0, 180);
      res.setHeader('Content-Type', media.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
      res.setHeader('Content-Length', String(buffer.length));
      res.status(HTTP_STATUS.OK).send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async adminList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const data = await chatService.adminListConversations(page, limit);
      sendSuccess(res, data, 'Admin conversations fetched');
    } catch (error) {
      next(error);
    }
  }

  async adminListMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const data = await chatService.adminListMessages(String(req.params.id), page, limit);
      sendSuccess(res, data, 'Admin conversation messages fetched');
    } catch (error) {
      next(error);
    }
  }
}

export const chatController = new ChatController();
