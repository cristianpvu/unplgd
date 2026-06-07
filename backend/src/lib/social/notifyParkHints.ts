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
import { sendPush } from '../push/expoPush.js';

const MIN_SIMILARITY_FOR_NOTIFY = 0.25;
const COOLDOWN_DAYS_SAME_SLOT = 14;
const MAX_HINTS_PER_WEEK = 2;
const USER_ACTIVITY_LOOKBACK_DAYS = 7;
const MS_PER_DAY = 86400000;

export type NotifyResult = {
  totalUsersScanned: number;
  notificationsCreated: number;
  pushSent: number;
  pushFailed: number;
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

function buildTitle(_petName: string | null): string {
  // Title sugestiv — NU promitem prezenta, e o prezicere din pattern istoric.
  return 'Idee pentru tine';
}

function buildBody(match: ParkMatch): string {
  const day = DAYS_OF_WEEK.find((d) => d.id === match.dayOfWeek)?.label ?? 'zi';
  const dayCap = day.charAt(0).toUpperCase() + day.slice(1);
  const hourRange = `${match.hourStart}-${match.hourEnd}`;
  // "De obicei vin" semnaleaza ca-i pattern, nu garantie. User-ul intelege
  // ca exista posibilitatea sa nu fie nimeni — dar e cel mai bun pariu.
  return `${dayCap} ${hourRange} · ${match.parkName} — de obicei vin copii cu pasiuni similare`;
}

/**
 * Ruleaza notificator pe TOTI userii. Pe user-i mari, batch-uim eventual.
 * Pe MVP zecimi de useri, e ok sa rulam linear.
 */
export async function runNotifyParkHints(): Promise<NotifyResult> {
  const result: NotifyResult = {
    totalUsersScanned: 0,
    notificationsCreated: 0,
    pushSent: 0,
    pushFailed: 0,
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

      // Pet name + pushToken + bbox parc intr-un Promise.all. Centrul bbox-ului
      // serveste ca destinatie pentru butonul de indicatii din modal.
      const [pet, userInfo, park] = await Promise.all([
        prisma.pet.findUnique({ where: { userId }, select: { name: true } }),
        prisma.user.findUnique({ where: { id: userId }, select: { pushToken: true } }),
        prisma.park.findUnique({
          where: { id: eligibleMatch.parkId },
          select: { bboxMinLat: true, bboxMaxLat: true, bboxMinLng: true, bboxMaxLng: true },
        }),
      ]);

      const lat = park ? (park.bboxMinLat + park.bboxMaxLat) / 2 : null;
      const lng = park ? (park.bboxMinLng + park.bboxMaxLng) / 2 : null;

      const title = buildTitle(pet?.name ?? null);
      const body = buildBody(eligibleMatch);
      const notifPayload = {
        slotKey: slotKey(eligibleMatch),
        parkId: eligibleMatch.parkId,
        parkOsmId: eligibleMatch.parkOsmId,
        parkName: eligibleMatch.parkName,
        dayOfWeek: eligibleMatch.dayOfWeek,
        hourStart: eligibleMatch.hourStart,
        hourEnd: eligibleMatch.hourEnd,
        similarity: eligibleMatch.similarity,
        sharedDomains: eligibleMatch.sharedDomains.map((d) => d.slug),
        lat,
        lng,
      };

      const created = await prisma.notification.create({
        data: { userId, kind: 'park_hint', title, body, payload: notifPayload },
      });
      result.notificationsCreated += 1;

      // Push notification — daca user-ul are token, trimite si push.
      // In-app notification ramane salvata oricum. Push e best-effort.
      if (userInfo?.pushToken) {
        try {
          const ok = await sendPush({
            to: userInfo.pushToken,
            title,
            body,
            data: {
              kind: 'park_hint',
              notificationId: created.id,
              ...notifPayload,
            },
            channelId: 'park_hints',
          });
          if (ok) result.pushSent += 1;
          else result.pushFailed += 1;
        } catch (err) {
          logger.warn({ err, userId }, 'notify_park_hints.push_failed');
          result.pushFailed += 1;
        }
      }
    } catch (err) {
      logger.warn({ err, userId }, 'notify_park_hints.user_failed');
    }
  }

  logger.info({ result }, 'notify_park_hints.completed');
  return result;
}
