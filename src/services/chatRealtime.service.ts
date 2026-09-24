import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { env } from '../config/env';
import { verifyAccessToken } from '../utils/jwt';
import { Conversation } from '../models/Conversation';

type SocketUser = {
  userId: string;
  role: string;
};

/**
 * Socket.IO realtime bus for chat (113, 116).
 * Auth: JWT in handshake auth.token or Authorization header.
 */
class ChatRealtimeService {
  private io: Server | null = null;

  attach(httpServer: HttpServer): void {
    if (this.io) return;

    this.io = new Server(httpServer, {
      path: '/socket.io',
      cors: {
        origin: env.corsOrigins.length ? [...env.corsOrigins] : env.clientUrl,
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.io.use((socket, next) => {
      try {
        const raw =
          (socket.handshake.auth?.token as string | undefined) ||
          (typeof socket.handshake.headers.authorization === 'string'
            ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
            : '');
        if (!raw) {
          next(new Error('Unauthorized'));
          return;
        }
        const payload = verifyAccessToken(raw);
        (socket.data as { user?: SocketUser }).user = {
          userId: payload.userId,
          role: payload.role,
        };
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const user = (socket.data as { user?: SocketUser }).user;
      if (!user) {
        socket.disconnect(true);
        return;
      }

      void socket.join(`user:${user.userId}`);

      socket.on('chat:join', async (payload: { conversationId?: string }, ack?: (r: unknown) => void) => {
        try {
          const conversationId = payload?.conversationId;
          if (!conversationId) {
            ack?.({ ok: false, error: 'conversationId required' });
            return;
          }
          const conversation = await Conversation.findById(conversationId).select(
            'candidateUserId employerUserId closedAt',
          );
          if (!conversation || conversation.closedAt) {
            ack?.({ ok: false, error: 'not found' });
            return;
          }
          const allowed =
            conversation.candidateUserId.toString() === user.userId ||
            conversation.employerUserId.toString() === user.userId;
          if (!allowed) {
            ack?.({ ok: false, error: 'forbidden' });
            return;
          }
          await socket.join(`conversation:${conversationId}`);
          ack?.({ ok: true });
        } catch {
          ack?.({ ok: false, error: 'failed' });
        }
      });

      socket.on('chat:leave', async (payload: { conversationId?: string }) => {
        if (payload?.conversationId) {
          await socket.leave(`conversation:${payload.conversationId}`);
        }
      });

      socket.on('chat:typing', (payload: { conversationId?: string; typing?: boolean }) => {
        if (!payload?.conversationId) return;
        socket.to(`conversation:${payload.conversationId}`).emit('chat:typing', {
          conversationId: payload.conversationId,
          userId: user.userId,
          typing: Boolean(payload.typing),
        });
      });
    });
  }

  emitToConversation(conversationId: string, event: string, data: unknown): void {
    this.io?.to(`conversation:${conversationId}`).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.io?.to(`user:${userId}`).emit(event, data);
  }
}

export const chatRealtime = new ChatRealtimeService();
