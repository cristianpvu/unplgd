import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../env.js';

export type JwtPayload = { sub: string };

const EXPIRES_IN: SignOptions['expiresIn'] = '30d';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies JwtPayload, env.JWT_SECRET, {
    expiresIn: EXPIRES_IN,
  });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string' || !decoded.sub || typeof decoded.sub !== 'string') {
    throw new Error('Invalid token payload');
  }
  return { sub: decoded.sub };
}
