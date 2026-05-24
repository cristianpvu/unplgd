// Expo Push API client — proxy gratuit catre APNs (iOS) + FCM (Android).
// Zero setup de certificate, zero API key, zero billing. Limit: ~600
// notificari/sec, batch-able pana la 100 per request.
//
// Format token asteptat: ExponentPushToken[xxxxxxxxxxxx]
// Endpoint: https://exp.host/--/api/v2/push/send
//
// Documentatie: https://docs.expo.dev/push-notifications/sending-notifications/

import { logger } from '../logger.js';
import { prisma } from '../prisma.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

export type PushMessage = {
  to: string; // ExponentPushToken[...]
  title: string;
  body: string;
  data?: Record<string, unknown>; // payload arbitrar — primit in mobile la tap
  sound?: 'default' | null;
  badge?: number;
  // Channel ID pe Android — daca nu specificam, default channel. Setam ca sa
  // putem grupa notificari pe categorie in Settings/Android.
  channelId?: string;
};

type ExpoTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

type ExpoSendResponse = {
  data?: ExpoTicket | ExpoTicket[];
  errors?: Array<{ code: string; message: string }>;
};

/**
 * Trimite o sigura notificare. Wrap peste sendPushBatch pt simplitate la
 * apelantul singular.
 */
export async function sendPush(msg: PushMessage): Promise<boolean> {
  const results = await sendPushBatch([msg]);
  return results[0]?.success ?? false;
}

export type PushResult = {
  to: string;
  success: boolean;
  error?: string;
};

/**
 * Trimite un batch (max 100). Daca peste 100, le impart in chunks.
 * Detecteaza tokens invalide (`DeviceNotRegistered`) si le sterge din DB
 * automat ca sa nu mai incercam la urmatorul cron.
 */
export async function sendPushBatch(messages: PushMessage[]): Promise<PushResult[]> {
  if (messages.length === 0) return [];

  // Filtreaza tokens cu format invalid inca de la pornire.
  const valid = messages.filter((m) => isValidExpoToken(m.to));
  const invalid = messages.filter((m) => !isValidExpoToken(m.to));

  const results: PushResult[] = invalid.map((m) => ({
    to: m.to,
    success: false,
    error: 'invalid_token_format',
  }));

  // Trimitem in chunks de max BATCH_SIZE.
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const chunk = valid.slice(i, i + BATCH_SIZE);
    try {
      const resp = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(
          chunk.map((m) => ({
            to: m.to,
            title: m.title,
            body: m.body,
            data: m.data ?? {},
            sound: m.sound ?? 'default',
            badge: m.badge,
            channelId: m.channelId ?? 'park_hints',
          })),
        ),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        logger.warn(
          { status: resp.status, body: text.slice(0, 300), count: chunk.length },
          'expo_push.http_error',
        );
        for (const m of chunk) {
          results.push({ to: m.to, success: false, error: `http_${resp.status}` });
        }
        continue;
      }

      const json = (await resp.json()) as ExpoSendResponse;
      const tickets = Array.isArray(json.data) ? json.data : json.data ? [json.data] : [];

      for (let j = 0; j < chunk.length; j++) {
        const msg = chunk[j]!;
        const ticket = tickets[j];
        if (!ticket) {
          results.push({ to: msg.to, success: false, error: 'no_ticket' });
          continue;
        }
        if (ticket.status === 'ok') {
          results.push({ to: msg.to, success: true });
        } else {
          const errCode = ticket.details?.error ?? 'unknown';
          results.push({ to: msg.to, success: false, error: errCode });

          // Token-uri invalide la nivel device — sters automat din DB ca sa
          // nu mai incercam. `DeviceNotRegistered` apare cand user-ul a
          // de-instalat app-ul sau a respins notificari.
          if (errCode === 'DeviceNotRegistered') {
            try {
              await prisma.user.updateMany({
                where: { pushToken: msg.to },
                data: { pushToken: null, pushTokenUpdatedAt: null },
              });
              logger.info({ token: msg.to }, 'expo_push.token_cleared_DeviceNotRegistered');
            } catch (err) {
              logger.warn({ err }, 'expo_push.token_clear_failed');
            }
          }
        }
      }
    } catch (err) {
      logger.error({ err, count: chunk.length }, 'expo_push.fetch_failed');
      for (const m of chunk) {
        results.push({ to: m.to, success: false, error: 'fetch_failed' });
      }
    }
  }

  return results;
}

/**
 * Trimite o notificare unui anumit user. Returneaza false daca user-ul
 * n-are pushToken sau push-ul a esuat.
 */
export async function sendPushToUser(
  userId: string,
  payload: Omit<PushMessage, 'to'>,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true },
  });
  if (!user?.pushToken) return false;
  return sendPush({ to: user.pushToken, ...payload });
}

function isValidExpoToken(t: string | null | undefined): t is string {
  if (!t) return false;
  return t.startsWith('ExponentPushToken[') && t.endsWith(']');
}
