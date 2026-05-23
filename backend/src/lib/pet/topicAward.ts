// Acordare DomainXp pe baza topic-ului detectat dintr-un mesaj de pet chat.
// Pipeline:
//   1. Clasifica mesajul (Claude Haiku) -> domain root + confidence
//   2. Filtru: confidence >= MIN_CONFIDENCE
//   3. Cap zilnic per (user, domain) = MAX_PER_DAY (anti-spam: copilul nu va
//      farma sociabilitatea trimitand 100 mesaje despre fotbal intr-o ora)
//   4. awardDomainXp idempotent prin sourceId unic per mesaj
//
// Functia se cheama fire-and-forget din ruta de chat — orice failure e silent.

import { randomUUID } from 'node:crypto';
import { classifyTopic } from '../ai/topicClassify.js';
import { awardDomainXp, DOMAIN_REWARDS } from '../domains.js';
import { redis } from '../redis.js';
import { logger } from '../logger.js';

const MIN_CONFIDENCE = 0.6;
const MAX_PER_DAY = 5;

function dayUtcKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function capKey(userId: string, domain: string): string {
  return `topic:cap:${userId}:${domain}:${dayUtcKey()}`;
}

/**
 * Cap zilnic per (user, domain). Returneaza true daca quota mai are loc si
 * incrementeaza atomic counter-ul; false daca s-a atins limita.
 */
async function tryConsumeQuota(userId: string, domain: string): Promise<boolean> {
  try {
    const key = capKey(userId, domain);
    const count = await redis.incr(key);
    if (count === 1) {
      // Prima utilizare a zilei — seteaza TTL 25h (acopera trecerea de la
      // UTC midnight chiar daca ceasurile au mici drift-uri).
      await redis.expire(key, 25 * 60 * 60);
    }
    return count <= MAX_PER_DAY;
  } catch (err) {
    // Redis down -> permisiv, mai bine sa risc dublu award decat sa pierd date.
    logger.warn({ err, userId, domain }, 'topic.cap_check_failed');
    return true;
  }
}

/**
 * Detecteaza topic + acordeaza interest in domain. Fire-and-forget.
 * Returneaza un summary pt logging — apelantul ignora de obicei rezultatul.
 */
export async function awardTopicFromMessage(
  userId: string,
  message: string,
): Promise<{ awarded: boolean; domain: string | null; confidence: number; reason?: string }> {
  const classification = await classifyTopic(message);
  if (!classification) {
    return { awarded: false, domain: null, confidence: 0, reason: 'classify_failed' };
  }

  const { domain, confidence } = classification;
  if (domain === null) {
    return { awarded: false, domain: null, confidence: 0, reason: 'no_clear_topic' };
  }
  if (confidence < MIN_CONFIDENCE) {
    return { awarded: false, domain, confidence, reason: 'low_confidence' };
  }

  const quotaOk = await tryConsumeQuota(userId, domain);
  if (!quotaOk) {
    return { awarded: false, domain, confidence, reason: 'daily_cap_reached' };
  }

  // sourceId unic per mesaj — nu retry-uim niciodata acelasi mesaj, deci nu
  // ne pasa de idempotenta cross-call. UUID e mai sigur decat timestamp-only
  // pentru a evita coliziuni cand 2 mesaje rapide-rapid intra in aceeasi ms.
  const sourceId = `pet_${randomUUID()}`;
  try {
    await awardDomainXp(
      userId,
      domain,
      DOMAIN_REWARDS.PET_TOPIC_DETECTED,
      'pet_message',
      sourceId,
      `Topic detectat din chat pet (conf ${confidence.toFixed(2)})`,
    );
    return { awarded: true, domain, confidence };
  } catch (err) {
    logger.warn({ err, userId, domain }, 'topic.award_failed');
    return { awarded: false, domain, confidence, reason: 'award_threw' };
  }
}
