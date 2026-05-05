import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';
import type { Request } from 'express';

function userKey(req: Request): string {
  return req.userId ?? ipKeyGenerator(req.ip ?? '');
}

function make(overrides: Partial<Options>) {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: userKey,
    message: { error: 'rate_limited', message: 'Prea multe cereri, incearca mai tarziu' },
    ...overrides,
  });
}

// Cerinta coordonator: rate limit pe /interactions/checkin pentru a preveni abuz XP.
export const checkinRateLimit = make({ windowMs: 60_000, limit: 10 });

// Bonus: protectie brute-force pe auth.
export const authRateLimit = make({ windowMs: 60_000, limit: 10 });

// Chat AI cu pet-ul — 20 mesaje/min/user (cap rezonabil pentru interactiune
// continua, dar protejeaza bill-ul Anthropic de abuz copy-paste).
export const petChatRateLimit = make({ windowMs: 60_000, limit: 20 });
