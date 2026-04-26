import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/hash.js';
import { signToken } from '../lib/jwt.js';
import { ensureDefaultPet } from '../lib/pet.js';
import { badRequest, conflict, unauthorized } from '../lib/errors.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().trim().min(2).max(40),
  password: z.string().min(8).max(128),
  birthDate: z.coerce.date(),
});

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);

    const age = yearsBetween(body.birthDate, new Date());
    if (age < 6 || age > 14) {
      throw badRequest('invalid_age', 'Varsta trebuie sa fie intre 6 si 14 ani');
    }

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw conflict('email_taken', 'Email deja inregistrat');

    // Avatarul se creeaza lazy la primul GET /me/avatar — separa concernurile
    // (auth nu cunoaste catalogul) si tine register-ul rapid (fara render SVG).
    // Pet-ul se creeaza acum (lookup specie default = 1 query, ieftin) ca
    // mobile sa-l aiba garantat la primul GET /me/pet, fara branch lazy.
    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        birthDate: body.birthDate,
        passwordHash: await hashPassword(body.password),
      },
    });

    await ensureDefaultPet(user.id);

    res.status(201).json({
      token: signToken(user.id),
      user: publicUser(user),
    });
  } catch (e) {
    next(e);
  }
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) throw unauthorized('invalid_credentials', 'Email sau parola gresite');

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) throw unauthorized('invalid_credentials', 'Email sau parola gresite');

    res.json({ token: signToken(user.id), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

function publicUser(u: {
  id: string;
  email: string;
  name: string;
  birthDate: Date;
  xp: number;
  level: number;
  createdAt: Date;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    birthDate: u.birthDate,
    xp: u.xp,
    level: u.level,
    createdAt: u.createdAt,
  };
}

function yearsBetween(from: Date, to: Date): number {
  let age = to.getFullYear() - from.getFullYear();
  const m = to.getMonth() - from.getMonth();
  if (m < 0 || (m === 0 && to.getDate() < from.getDate())) age--;
  return age;
}
