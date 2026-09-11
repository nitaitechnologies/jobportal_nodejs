import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import type { AccessTokenPayload } from '../types/auth.types';
import type { UserRole } from '../constants/enums';

const JWT_ALGORITHMS = ['HS256'] as const;

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
    algorithm: 'HS256',
  };

  const claims: AccessTokenPayload = {
    userId: payload.userId,
    role: payload.role,
  };

  if (payload.adminUserId) {
    claims.adminUserId = payload.adminUserId;
  }

  return jwt.sign(claims, env.jwtSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret, {
    algorithms: [...JWT_ALGORITHMS],
  });

  if (typeof decoded === 'string' || !isAccessTokenPayload(decoded)) {
    throw new Error('Invalid access token payload');
  }

  const payload: AccessTokenPayload = {
    userId: decoded.userId,
    role: decoded.role as UserRole,
  };

  if (typeof decoded.adminUserId === 'string' && decoded.adminUserId.length > 0) {
    payload.adminUserId = decoded.adminUserId;
  }

  return payload;
}

function isAccessTokenPayload(value: JwtPayload): value is JwtPayload & AccessTokenPayload {
  return typeof value.userId === 'string' && typeof value.role === 'string';
}
