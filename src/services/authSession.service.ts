import mongoose from 'mongoose';
import { env } from '../config/env';
import { HTTP_STATUS } from '../constants';
import type { UserRole } from '../constants/enums';
import { AuthSession } from '../models/AuthSession';
import { AppError } from '../utils/AppError';
import { signAccessToken } from '../utils/jwt';

function parseJwtTtlMs(): number {
  const raw = env.jwtExpiresIn.trim();
  const match = /^(\d+)([smhd])$/i.exec(raw);
  if (!match) {
    return 24 * 60 * 60 * 1000;
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const mult =
    unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return amount * mult;
}

export type SessionDeviceMeta = {
  deviceLabel?: string;
  userAgent?: string;
  ip?: string;
};

export class AuthSessionService {
  async createAccessToken(
    userId: string,
    role: UserRole,
    meta: SessionDeviceMeta = {},
    opts?: { adminUserId?: string; maxSessions?: number },
  ): Promise<{ accessToken: string; sessionId: string }> {
    const expiresAt = new Date(Date.now() + parseJwtTtlMs());
    const session = await AuthSession.create({
      userId: new mongoose.Types.ObjectId(userId),
      role,
      deviceLabel: (meta.deviceLabel ?? '').slice(0, 160),
      userAgent: (meta.userAgent ?? '').slice(0, 400),
      ip: (meta.ip ?? '').slice(0, 80),
      expiresAt,
      lastSeenAt: new Date(),
    });

    const maxSessions = opts?.maxSessions;
    if (maxSessions && maxSessions > 0) {
      await this.enforceMaxSessions(userId, maxSessions, session._id.toString());
    }

    const accessToken = signAccessToken({
      userId,
      role,
      jti: session._id.toString(),
      ...(opts?.adminUserId ? { adminUserId: opts.adminUserId } : {}),
    });

    return { accessToken, sessionId: session._id.toString() };
  }

  async assertActive(sessionId: string, userId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      throw new AppError('Session is no longer valid. Please sign in again.', HTTP_STATUS.UNAUTHORIZED);
    }
    const session = await AuthSession.findById(sessionId);
    if (
      !session ||
      session.userId.toString() !== userId ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new AppError('Session is no longer valid. Please sign in again.', HTTP_STATUS.UNAUTHORIZED);
    }
    session.lastSeenAt = new Date();
    await session.save();
  }

  async revoke(sessionId: string, userId: string): Promise<{ revoked: boolean }> {
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return { revoked: false };
    }
    const result = await AuthSession.updateOne(
      {
        _id: sessionId,
        userId: new mongoose.Types.ObjectId(userId),
        revokedAt: { $exists: false },
      },
      { $set: { revokedAt: new Date() } },
    );
    return { revoked: result.modifiedCount > 0 };
  }

  async revokeOthers(userId: string, keepSessionId?: string): Promise<{ revokedCount: number }> {
    const filter: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userId),
      revokedAt: { $exists: false },
    };
    if (keepSessionId && mongoose.Types.ObjectId.isValid(keepSessionId)) {
      filter._id = { $ne: new mongoose.Types.ObjectId(keepSessionId) };
    }
    const result = await AuthSession.updateMany(filter, { $set: { revokedAt: new Date() } });
    return { revokedCount: result.modifiedCount };
  }

  async listForUser(userId: string, currentSessionId?: string) {
    const sessions = await AuthSession.find({
      userId: new mongoose.Types.ObjectId(userId),
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    })
      .sort({ lastSeenAt: -1 })
      .limit(50);

    return sessions.map((session) => ({
      id: session._id.toString(),
      deviceLabel: session.deviceLabel || 'Unknown device',
      userAgent: session.userAgent || '',
      ip: session.ip || '',
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      current: currentSessionId ? session._id.toString() === currentSessionId : false,
    }));
  }

  private async enforceMaxSessions(
    userId: string,
    maxSessions: number,
    keepSessionId: string,
  ): Promise<void> {
    const active = await AuthSession.find({
      userId: new mongoose.Types.ObjectId(userId),
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: 1 });

    if (active.length <= maxSessions) return;

    const overflow = active.length - maxSessions;
    const toRevoke = active
      .filter((session) => session._id.toString() !== keepSessionId)
      .slice(0, overflow)
      .map((session) => session._id);

    if (toRevoke.length) {
      await AuthSession.updateMany(
        { _id: { $in: toRevoke } },
        { $set: { revokedAt: new Date() } },
      );
    }
  }
}

export const authSessionService = new AuthSessionService();
