import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest } from '../lib/errors.js';
import {
  acceptedFriendIds,
  dayKey,
  finalizeWeekForUser,
  isoWeekKey,
  rankedGroup,
  weekDaysFor,
} from '../lib/screentime.js';

export const screenTimeRouter = Router();
screenTimeRouter.use(requireAuth);

const reportSchema = z.object({
  // Implicit ziua curenta (Bucharest). Acceptam si raportarea unei zile
  // recente (device-ul poate trimite totalul de ieri la prima deschidere).
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'day trebuie YYYY-MM-DD')
    .optional(),
  minutes: z.number().int().min(0).max(1440),
  source: z.enum(['android_usagestats', 'manual']).default('android_usagestats'),
});

// Device-ul trimite screen time-ul total al zilei. Upsert pe (userId, day):
// ultimul raport suprascrie (valoarea creste pe parcursul zilei). Acceptam doar
// zile din ultimele 8 zile (anti backfill abuziv) si nu in viitor.
screenTimeRouter.post('/report', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { day, minutes, source } = reportSchema.parse(req.body);
    const today = dayKey();
    const target = day ?? today;

    if (target > today) throw badRequest('future_day', 'Nu poti raporta o zi viitoare');
    // Fereastra de acceptare: ultimele 8 zile.
    const earliest = dayKey(new Date(Date.now() - 8 * 86_400_000));
    if (target < earliest) throw badRequest('day_too_old', 'Ziua e prea veche pentru raportare');

    const saved = await prisma.screenTimeDay.upsert({
      where: { userId_day: { userId, day: target } },
      create: { userId, day: target, minutes, source },
      update: { minutes, source, reportedAt: new Date() },
    });

    res.status(201).json({ day: saved.day, minutes: saved.minutes });
  } catch (e) {
    next(e);
  }
});

// Leaderboard cercului de prieteni pentru saptamana CURENTA (live, ne-finalizat)
// + finalizeaza lazy saptamana TRECUTA si o returneaza in `lastWeek` (pt
// animatia de reward la deschidere).
screenTimeRouter.get('/leaderboard', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const now = new Date();

    // 1. Finalizare lazy a saptamanii trecute (acorda XP idempotent).
    const lastWeek = await finalizeWeekForUser(userId, new Date(now.getTime() - 7 * 86_400_000));

    // 2. Clasament live saptamana curenta peste cercul de prieteni + eu.
    const friendIds = await acceptedFriendIds(userId);
    const circleIds = [userId, ...friendIds];
    const days = weekDaysFor(now);
    const today = dayKey(now);

    const group = await rankedGroup(circleIds, days);

    // Date de afisare (nume + avatar) pt userii din clasament + minutele de azi.
    const rankedIds = group.map((g) => g.userId);
    const [users, todayRows] = await Promise.all([
      rankedIds.length
        ? prisma.user.findMany({
            where: { id: { in: rankedIds } },
            select: { id: true, name: true, level: true, avatar: { select: { svg: true } } },
          })
        : Promise.resolve([]),
      rankedIds.length
        ? prisma.screenTimeDay.findMany({
            where: { userId: { in: rankedIds }, day: today },
            select: { userId: true, minutes: true },
          })
        : Promise.resolve([]),
    ]);
    const usersById = new Map(users.map((u) => [u.id, u]));
    const todayById = new Map(todayRows.map((r) => [r.userId, r.minutes]));

    const entries = group.map((g, i) => {
      const u = usersById.get(g.userId);
      return {
        rank: i + 1,
        userId: g.userId,
        name: u?.name ?? '',
        level: u?.level ?? 1,
        avatarSvg: u?.avatar?.svg ?? null,
        avgMinutes: g.avgMinutes,
        daysReported: g.daysReported,
        todayMinutes: todayById.get(g.userId) ?? 0,
        isMe: g.userId === userId,
      };
    });

    const me = entries.find((e) => e.isMe) ?? null;

    res.json({
      weekKey: isoWeekKey(now),
      groupSize: group.length,
      me,
      entries,
      lastWeek,
    });
  } catch (e) {
    next(e);
  }
});
