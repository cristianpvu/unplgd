// Notificare zilnica "ai taskuri noi". Ruleaza din cron la 09:00 Bucharest.
//
// Pentru fiecare user activ (activitate in ultimele 7 zile), genereaza/asigura
// quest-urile zilei si trimite o notificare in-app + push (best-effort).
// Idempotent pe zi: Notification kind='daily_quests' cu payload.questDate.
//
// Mesajul VARIAZA — pool de formulari ca sa nu fie repetitiv. Limbaj jucaus,
// fara voce de pet (design standardizat ca park hints).

import { prisma } from '../prisma.js';
import { logger } from '../logger.js';
import { sendPush } from '../push/expoPush.js';
import { getOrCreateDailyQuests, questDateForNow } from './daily.js';

const USER_ACTIVITY_LOOKBACK_DAYS = 7;
const MS_PER_DAY = 86400000;

// Pool de mesaje. Alegem unul determinist pe (userId, questDate) ca acelasi
// user sa nu vada doua texte diferite daca cumva se ruleaza de doua ori.
const TITLES = [
  'Ai 3 taskuri noi azi',
  'Taskurile zilei te asteapta',
  'Hai sa castigi un cufar azi',
  'Misiuni noi pentru tine',
];

const BODIES = [
  'Termina-le pe toate 3 si primesti un cufar bonus!',
  'Cele mai multe te scot afara, la prieteni. Hai!',
  'Trei mici provocari azi — vezi ce ai de facut.',
  'Fiecare task terminat = XP. Toate 3 = cufar!',
];

function pickByHash(arr: string[], seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = (h >>> 0) % arr.length;
  return arr[idx] ?? arr[0]!;
}

export type QuestNotifyResult = {
  usersScanned: number;
  notificationsCreated: number;
  pushSent: number;
  alreadyNotified: number;
};

export async function runNotifyDailyQuests(): Promise<QuestNotifyResult> {
  const result: QuestNotifyResult = {
    usersScanned: 0,
    notificationsCreated: 0,
    pushSent: 0,
    alreadyNotified: 0,
  };

  const since = new Date(Date.now() - USER_ACTIVITY_LOOKBACK_DAYS * MS_PER_DAY);
  const activeUsers = await prisma.skillXpTransaction.findMany({
    where: { createdAt: { gte: since } },
    distinct: ['userId'],
    select: { userId: true },
  });
  result.usersScanned = activeUsers.length;

  const questDate = questDateForNow();

  for (const { userId } of activeUsers) {
    try {
      // Idempotent pe zi — daca am trimis deja, skip.
      const existing = await prisma.notification.findFirst({
        where: {
          userId,
          kind: 'daily_quests',
          payload: { path: ['questDate'], equals: questDate },
        },
      });
      if (existing) {
        result.alreadyNotified += 1;
        continue;
      }

      // Asiguram ca quest-urile zilei sunt generate (lazy) inainte sa notificam.
      await getOrCreateDailyQuests(userId);

      const title = pickByHash(TITLES, `${userId}|${questDate}|t`);
      const body = pickByHash(BODIES, `${userId}|${questDate}|b`);
      const payload = { questDate };

      const created = await prisma.notification.create({
        data: { userId, kind: 'daily_quests', title, body, payload },
      });
      result.notificationsCreated += 1;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { pushToken: true },
      });
      if (user?.pushToken) {
        try {
          const ok = await sendPush({
            to: user.pushToken,
            title,
            body,
            data: { kind: 'daily_quests', notificationId: created.id, ...payload },
            channelId: 'park_hints',
          });
          if (ok) result.pushSent += 1;
        } catch (err) {
          logger.warn({ err, userId }, 'notify_daily_quests.push_failed');
        }
      }
    } catch (err) {
      logger.warn({ err, userId }, 'notify_daily_quests.user_failed');
    }
  }

  logger.info({ result }, 'notify_daily_quests.completed');
  return result;
}
