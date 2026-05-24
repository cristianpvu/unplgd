// Notify park hints — pentru fiecare user activ, gaseste cel mai bun park
// match si creeaza o Notification daca:
//   1. Match-ul are similaritate decenta (>= 0.25)
//   2. Userul n-a primit deja notificare pentru ACEST slot in ultimele 14 zile
//   3. Userul n-a primit deja 2 notificari de tip "park_hint" in saptamana curenta
//   4. Userul are activitate recenta (a folosit app-ul in ultimele 7 zile)
//
// Returneaza statistici. NU trimite push — Tier 1 doar in-app. Cron-ul ar
// trebui sa apeleze asta zilnic dimineata; momentan e admin-triggered.

import { prisma } from '../prisma.js';
import { logger } from '../logger.js';
import { getTopParkMatchesForUser, type ParkMatch } from './parkMatcher.js';
import { DAYS_OF_WEEK } from './parkAggregates.js';

const MIN_SIMILARITY_FOR_NOTIFY = 0.25;
const COOLDOWN_DAYS_SAME_SLOT = 14;
const MAX_HINTS_PER_WEEK = 2;
const USER_ACTIVITY_LOOKBACK_DAYS = 7;
const MS_PER_DAY = 86400000;

export type NotifyResult = {
  totalUsersScanned: number;
  notificationsCreated: number;
  skipped: {
    inactiveUsers: number;
    weeklyCapReached: number;
    cooldownSameSlot: number;
    noGoodMatch: number;
  };
};

function startOfWeekISO(d = new Date()): Date {
  // ISO week starts Monday. Subtract days to monday 00:00 UTC.
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (dt.getUTCDay() + 6) % 7; // 0 = Monday
  dt.setUTCDate(dt.getUTCDate() - dayNum);
  return dt;
}

function slotKey(m: ParkMatch): string {
  return `${m.parkId}|${m.dayOfWeek}|${m.hourBucket}`;
}

function buildTitle(petName: string | null): string {
  if (petName) return `${petName} zice...`;
  return 'Prietenul tau zice...';
}

function buildBody(match: ParkMatch): string {
  const day = DAYS_OF_WEEK.find((d) => d.id === match.dayOfWeek)?.label ?? 'zi';
  // Capitalize day for readability.
  const dayCap = day.charAt(0).toUpperCase() + day.slice(1);
  const hourRange = `${match.hourStart}-${match.hourEnd}`;
  return `${dayCap} ${hourRange} in ${match.parkName} — copii care iubesc aceleasi lucruri ca tine vor fi acolo. Vino!`;
}

/**
 * Ruleaza notificator pe TOTI userii. Pe user-i mari, batch-uim eventual.
 * Pe MVP zecimi de useri, e ok sa rulam linear.
 */
export async function runNotifyParkHints(): Promise<NotifyResult> {
  const result: NotifyResult = {
    totalUsersScanned: 0,
    notificationsCreated: 0,
    skipped: {
      inactiveUsers: 0,
      weeklyCapReached: 0,
      cooldownSameSlot: 0,
      noGoodMatch: 0,
    },
  };

  // Useri activi: au cel putin un SkillXpTransaction in ultimele 7 zile.
  // Asa evitam sa notificam conturi abandonate.
  const activitySince = new Date(Date.now() - USER_ACTIVITY_LOOKBACK_DAYS * MS_PER_DAY);
  const activeUserIds = await prisma.skillXpTransaction.findMany({
    where: { createdAt: { gte: activitySince } },
    distinct: ['userId'],
    select: { userId: true },
  });
  result.totalUsersScanned = activeUserIds.length;

  const weekStart = startOfWeekISO();
  const cooldownStart = new Date(Date.now() - COOLDOWN_DAYS_SAME_SLOT * MS_PER_DAY);

  for (const { userId } of activeUserIds) {
    try {
      // Cap saptamanal: 2 notificari park_hint deja in saptamana curenta = skip.
      const weeklyCount = await prisma.notification.count({
        where: {
          userId,
          kind: 'park_hint',
          createdAt: { gte: weekStart },
        },
      });
      if (weeklyCount >= MAX_HINTS_PER_WEEK) {
        result.skipped.weeklyCapReached += 1;
        continue;
      }

      const matches = await getTopParkMatchesForUser(userId, 3);
      const eligibleMatch = matches.find((m) => m.similarity >= MIN_SIMILARITY_FOR_NOTIFY);
      if (!eligibleMatch) {
        result.skipped.noGoodMatch += 1;
        continue;
      }

      // Cooldown 14 zile pe acelasi (parkId, dayOfWeek, hourBucket). Cautam in
      // payload-ul notificarilor anterioare.
      const sameSlotRecent = await prisma.notification.findFirst({
        where: {
          userId,
          kind: 'park_hint',
          createdAt: { gte: cooldownStart },
          payload: {
            path: ['slotKey'],
            equals: slotKey(eligibleMatch),
          },
        },
      });
      if (sameSlotRecent) {
        result.skipped.cooldownSameSlot += 1;
        continue;
      }

      // Take pet name pentru title personalizat.
      const pet = await prisma.pet.findUnique({
        where: { userId },
        select: { name: true },
      });

      await prisma.notification.create({
        data: {
          userId,
          kind: 'park_hint',
          title: buildTitle(pet?.name ?? null),
          body: buildBody(eligibleMatch),
          payload: {
            slotKey: slotKey(eligibleMatch),
            parkId: eligibleMatch.parkId,
            parkOsmId: eligibleMatch.parkOsmId,
            parkName: eligibleMatch.parkName,
            dayOfWeek: eligibleMatch.dayOfWeek,
            hourStart: eligibleMatch.hourStart,
            hourEnd: eligibleMatch.hourEnd,
            similarity: eligibleMatch.similarity,
            sharedDomains: eligibleMatch.sharedDomains.map((d) => d.slug),
          },
        },
      });
      result.notificationsCreated += 1;
    } catch (err) {
      logger.warn({ err, userId }, 'notify_park_hints.user_failed');
    }
  }

  logger.info({ result }, 'notify_park_hints.completed');
  return result;
}
