import { HTTP_STATUS } from '../constants';
import { DeviceToken } from '../models/DeviceToken';
import { AppError } from '../utils/AppError';

export type PushPlatform = 'android' | 'ios' | 'web';
export type PushApp = 'candidate' | 'employer' | 'admin';

export type PushPayload = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

function fcmServerKey(): string {
  return (process.env.FCM_SERVER_KEY ?? '').trim();
}

export function isPushConfigured(): boolean {
  return Boolean(fcmServerKey());
}

/**
 * Register / refresh a device token (sheet 472).
 */
export async function registerDeviceToken(input: {
  userId: string;
  token: string;
  platform?: PushPlatform;
  app?: PushApp;
}) {
  const token = input.token.trim();
  if (token.length < 20) {
    throw new AppError('Invalid device token', HTTP_STATUS.BAD_REQUEST, [
      { path: 'token', message: 'Device token is too short' },
    ]);
  }

  const doc = await DeviceToken.findOneAndUpdate(
    { token },
    {
      $set: {
        userId: input.userId,
        token,
        platform: input.platform ?? 'android',
        app: input.app ?? 'candidate',
        lastSeenAt: new Date(),
        active: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return {
    device: {
      id: doc!._id.toString(),
      platform: doc!.platform,
      app: doc!.app,
      active: doc!.active,
      lastSeenAt: doc!.lastSeenAt,
    },
  };
}

export async function unregisterDeviceToken(userId: string, token: string) {
  await DeviceToken.updateMany(
    { userId, token: token.trim() },
    { $set: { active: false } },
  );
  return { unregistered: true };
}

async function sendViaFcm(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<{ sent: number; failed: number }> {
  const key = fcmServerKey();
  if (!key || tokens.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  // Legacy FCM HTTP API — works with server key; swap to HTTP v1 when migrating.
  for (const token of tokens) {
    try {
      const res = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          Authorization: `key=${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          notification: { title, body },
          data: data ?? {},
          priority: 'high',
        }),
      });
      if (res.ok) sent += 1;
      else {
        failed += 1;
        if (res.status === 404 || res.status === 400) {
          await DeviceToken.updateOne({ token }, { $set: { active: false } });
        }
      }
    } catch {
      failed += 1;
    }
  }

  return { sent, failed };
}

/**
 * Central push notification service (sheet 472).
 * Without FCM_SERVER_KEY, logs payloads so local/staging still "works".
 */
export async function sendPushToUser(payload: PushPayload): Promise<{
  delivered: boolean;
  mode: 'fcm' | 'log';
  deviceCount: number;
  sent: number;
  failed: number;
}> {
  const tokens = await DeviceToken.find({
    userId: payload.userId,
    active: true,
  })
    .select('token')
    .lean();

  const tokenList = tokens.map((t) => t.token).filter(Boolean);
  if (tokenList.length === 0) {
    return { delivered: false, mode: isPushConfigured() ? 'fcm' : 'log', deviceCount: 0, sent: 0, failed: 0 };
  }

  if (!isPushConfigured()) {
    console.info(
      `[push:log] user=${payload.userId} devices=${tokenList.length} title=${payload.title}`,
    );
    return {
      delivered: true,
      mode: 'log',
      deviceCount: tokenList.length,
      sent: tokenList.length,
      failed: 0,
    };
  }

  const result = await sendViaFcm(
    tokenList,
    payload.title.slice(0, 100),
    payload.body.slice(0, 500),
    payload.data,
  );

  return {
    delivered: result.sent > 0,
    mode: 'fcm',
    deviceCount: tokenList.length,
    sent: result.sent,
    failed: result.failed,
  };
}

export const pushService = {
  registerDeviceToken,
  unregisterDeviceToken,
  sendPushToUser,
  isPushConfigured,
};
