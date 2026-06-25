// Screen-time leaderboard — logica de zi/saptamana + finalizare lazy.
//
// MISIUNE: recompensam timpul PUTIN pe telefon. Device-ul (Android, via
// UsageStatsManager) trimite raportul zilnic; la finalul saptamanii fiecare
// user e clasat in cercul lui de prieteni (prieteni acceptati + el insusi,
// doar cei cu date) si primeste XP dupa pozitie. Mai putine minute = loc mai
// bun = mai mult XP.
//
// Finalizarea e LAZY (fara cron): la primul GET /leaderboard dintr-o saptamana
// noua, calculam si premiem saptamana TRECUTA, idempotent prin unique
// (userId, weekKey) pe ScreenTimeWeek + awardXp idempotent. Acelasi pattern ca
// daily quests / avatar backfill.

import { FriendshipStatus, Prisma, type ScreenTimeWeek } from '@prisma/client';
import { prisma } from './prisma.js';
import { awardXp, XP_REWARDS } from './xp.js';

const BUCHAREST_TZ = 'Europe/Bucharest';
const ymdFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: BUCHAREST_TZ });
const MS_PER_DAY = 86_400_000;

// 'YYYY-MM-DD' pe TZ Europe/Bucharest pentru un moment dat.
export function dayKey(now: Date = new Date()): string {
  return ymdFmt.format(now);
}

// Parseaza 'YYYY-MM-DD' la un Date la pranz UTC (DST-safe pentru aritmetica
// de zile). Lucram pe data locala Bucharest, deci pornim de la string-ul deja
// formatat in tz.
function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12));
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

// Cheia saptamanii ISO (Luni-Duminica) pe baza datei locale Bucharest.
export function isoWeekKey(ref: Date = new Date()): string {
  const base = parseYmd(dayKey(ref));
  const dayNum = base.getUTCDay() || 7;
  base.setUTCDate(base.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(base.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((base.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7);
  return `${base.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// Cele 7 zile (string-uri 'YYYY-MM-DD' Bucharest) din saptamana ISO care
// contine `ref`. Luni .. Duminica.
export function weekDaysFor(ref: Date = new Date()): string[] {
  const base = parseYmd(dayKey(ref));
  const dayNum = base.getUTCDay() || 7; // 1=Luni .. 7=Duminica
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() - (dayNum - 1));
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    out.push(ymd(d));
  }
  return out;
}

export type RankRow = { userId: string; avgMinutes: number; daysReported: number };

// XP dupa pozitie (1-based, 1 = cel mai putin timp pe ecran).
export function rankReward(rank: number): number {
  if (rank === 1) return XP_REWARDS.SCREENTIME_WEEK_RANK_1;
  if (rank === 2) return XP_REWARDS.SCREENTIME_WEEK_RANK_2;
  if (rank === 3) return XP_REWARDS.SCREENTIME_WEEK_RANK_3;
  return XP_REWARDS.SCREENTIME_WEEK_PARTICIPATION;
}

export async function acceptedFriendIds(userId: string): Promise<string[]> {
  const fs = await prisma.friendship.findMany({
    where: {
      status: FriendshipStatus.ACCEPTED,
      OR: [{ requesterId: userId }, { receiverId: userId }],
    },
    select: { requesterId: true, receiverId: true },
  });
  return fs.map((f) => (f.requesterId === userId ? f.receiverId : f.requesterId));
}

// Construieste clasamentul (mai putine minute = mai sus) pentru un set de
// useri peste zilele date. Doar userii cu cel putin o zi raportata intra.
// Tie-break: mai multe zile raportate intai (consistenta), apoi userId
// (determinist).
export async function rankedGroup(userIds: string[], days: string[]): Promise<RankRow[]> {
  if (userIds.length === 0 || days.length === 0) return [];
  const rows = await prisma.screenTimeDay.findMany({
    where: { userId: { in: userIds }, day: { in: days } },
    select: { userId: true, minutes: true },
  });
  const agg = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const a = agg.get(r.userId) ?? { sum: 0, n: 0 };
    a.sum += r.minutes;
    a.n += 1;
    agg.set(r.userId, a);
  }
  const group: RankRow[] = [];
  for (const [userId, a] of agg) {
    group.push({ userId, avgMinutes: Math.round(a.sum / a.n), daysReported: a.n });
  }
  group.sort(
    (x, y) =>
      x.avgMinutes - y.avgMinutes ||
      y.daysReported - x.daysReported ||
      x.userId.localeCompare(y.userId),
  );
  return group;
}

export type WeekResult = {
  weekKey: string;
  rank: number;
  groupSize: number;
  avgMinutes: number;
  daysReported: number;
  xpAwarded: number;
};

function toResult(w: ScreenTimeWeek): WeekResult {
  return {
    weekKey: w.weekKey,
    rank: w.rank,
    groupSize: w.groupSize,
    avgMinutes: w.avgMinutes,
    daysReported: w.daysReported,
    xpAwarded: w.xpAwarded,
  };
}

// Finalizeaza (idempotent) saptamana care contine `weekRef` pentru un user:
// calculeaza rank-ul in cercul lui de prieteni si acorda XP. Returneaza null
// daca userul nu a raportat date in acea saptamana (nimic de premiat).
export async function finalizeWeekForUser(
  userId: string,
  weekRef: Date,
): Promise<WeekResult | null> {
  const weekKey = isoWeekKey(weekRef);

  const existing = await prisma.screenTimeWeek.findUnique({
    where: { userId_weekKey: { userId, weekKey } },
  });
  if (existing) return toResult(existing);

  const days = weekDaysFor(weekRef);
  const friendIds = await acceptedFriendIds(userId);
  const group = await rankedGroup([userId, ...friendIds], days);

  const rankIdx = group.findIndex((g) => g.userId === userId);
  if (rankIdx === -1) return null; // userul nu a raportat date → nimic de premiat

  const mine = group[rankIdx]!;
  const rank = rankIdx + 1;
  const xp = rankReward(rank);

  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.screenTimeWeek.create({
        data: {
          userId,
          weekKey,
          avgMinutes: mine.avgMinutes,
          daysReported: mine.daysReported,
          rank,
          groupSize: group.length,
          xpAwarded: xp,
        },
      });
      await awardXp(
        userId,
        xp,
        'screentime_week',
        weekKey,
        `Screen-time ${weekKey} — locul ${rank} din ${group.length}`,
        tx,
      );
      return created;
    });
    return toResult(row);
  } catch (e) {
    // Race: alt request a finalizat intre timp. Returnam randul existent.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const r = await prisma.screenTimeWeek.findUnique({
        where: { userId_weekKey: { userId, weekKey } },
      });
      if (r) return toResult(r);
    }
    throw e;
  }
}
