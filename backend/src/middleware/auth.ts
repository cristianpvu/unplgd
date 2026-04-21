import type { RequestHandler } from 'express';
import { unauthorized } from '../lib/errors.js';
import { verifyToken } from '../lib/jwt.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(unauthorized('missing_token', 'Missing Authorization header'));
  }
  try {
    const { sub } = verifyToken(header.slice(7));
    req.userId = sub;
    next();
  } catch {
    next(unauthorized('invalid_token', 'Invalid or expired token'));
  }
};
