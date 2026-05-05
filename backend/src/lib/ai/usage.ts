import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from './client.js';
import { redis } from '../redis.js';
import { logger } from '../logger.js';

// Tracker pentru consum Anthropic. Anthropic NU expune endpoint public ca sa
// verifici totalul fara acces la console — il calculam local: pentru fiecare
// request stocam tokens-urile returnate de API in `usage` si calculam cost-ul
// dupa pricing tabel. Persistat in Redis pe key-uri zilnice + total agregat.

// Pricing per million tokens. Sursa: anthropic.com/pricing.
// IMPORTANT: cand Anthropic schimba preturi sau apar modele noi, completeaza
// aici altfel cost-ul calculat va fi gresit pentru modelele necunoscute.
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-opus-4-7':       { input: 15,    output: 75 },
  'claude-sonnet-4-6':     { input: 3,     output: 15 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
};

const REDIS_KEY_TOTAL = 'ai:usage:total';
function dailyKey(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `ai:usage:day:${y}-${m}-${day}`;
}

export type UsageStats = {
  totalCostUsd: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  daily: Record<string, {
    costUsd: number;
    calls: number;
    inputTokens: number;
    outputTokens: number;
  }>;
};

// Wrapper peste anthropic.messages.create care contorizeaza tokens + cost.
// Folosit din toate rutele in loc de apelul direct, asa centralizam tracking-ul.
//
// `feature` e doar pentru logger (ex. "pet_chat", "story_create") — nu schimba
// nimic la apel.
export async function claudeMessages(
  params: Anthropic.MessageCreateParamsNonStreaming,
  feature: string,
): Promise<Anthropic.Message> {
  const completion = await anthropic.messages.create(params);

  const inTok = completion.usage?.input_tokens ?? 0;
  const outTok = completion.usage?.output_tokens ?? 0;
  const model = completion.model;
  const pricing = PRICING_PER_MTOK[model];
  if (!pricing) {
    logger.warn({ model, feature }, 'usage.unknown_model_pricing — cost neestimat');
  }
  const costUsd = pricing
    ? (inTok / 1_000_000) * pricing.input + (outTok / 1_000_000) * pricing.output
    : 0;

  // Best-effort persistence — daca Redis cade, log-uim si mergem mai departe;
  // request-ul user-ului nu trebuie sa fie afectat.
  try {
    const day = dailyKey();
    const pipe = redis.pipeline();
    pipe.hincrby(REDIS_KEY_TOTAL, 'calls', 1);
    pipe.hincrby(REDIS_KEY_TOTAL, 'inputTokens', inTok);
    pipe.hincrby(REDIS_KEY_TOTAL, 'outputTokens', outTok);
    pipe.hincrbyfloat(REDIS_KEY_TOTAL, 'costUsd', costUsd);
    pipe.hincrby(day, 'calls', 1);
    pipe.hincrby(day, 'inputTokens', inTok);
    pipe.hincrby(day, 'outputTokens', outTok);
    pipe.hincrbyfloat(day, 'costUsd', costUsd);
    // TTL 90 zile pe daily — mai mult decat avem nevoie pana la licenta.
    pipe.expire(day, 90 * 24 * 60 * 60);
    await pipe.exec();
  } catch (err) {
    logger.error({ err }, 'usage.redis_persist_failed');
  }

  logger.info(
    {
      feature,
      model,
      inputTokens: inTok,
      outputTokens: outTok,
      costUsd: Number(costUsd.toFixed(6)),
    },
    'claude.usage',
  );

  return completion;
}

export async function getUsageStats(daysBack = 30): Promise<UsageStats> {
  const total = await redis.hgetall(REDIS_KEY_TOTAL);
  const daily: UsageStats['daily'] = {};

  // Last N zile (inclusiv azi). Citim individual ca sa avem cheile-data
  // sortate, indiferent ce-i in Redis.
  for (let i = 0; i < daysBack; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = dailyKey(d);
    const raw = await redis.hgetall(key);
    if (!raw || Object.keys(raw).length === 0) continue;
    daily[key.replace('ai:usage:day:', '')] = {
      costUsd: Number(raw.costUsd ?? 0),
      calls: Number(raw.calls ?? 0),
      inputTokens: Number(raw.inputTokens ?? 0),
      outputTokens: Number(raw.outputTokens ?? 0),
    };
  }

  return {
    totalCostUsd: Number(total?.costUsd ?? 0),
    totalCalls: Number(total?.calls ?? 0),
    totalInputTokens: Number(total?.inputTokens ?? 0),
    totalOutputTokens: Number(total?.outputTokens ?? 0),
    daily,
  };
}
