// Zero-shot topic classifier pentru mesajele copilului catre pet. Detecteaza
// DOMENIUL (sport, animale, stiinte, ...) dintr-o lista finita de slug-uri,
// folosind Claude Haiku ca clasificator LLM.
//
// Conceptual aliniat cu articolul Dobrita et al. (BERT skill extraction pe job
// descriptions): text → clasificare pe taxonomie finita → match canonical slug.
// Diferenta: folosim LLM zero-shot in loc de BERT fine-tuned, ca sa eliminam
// nevoia de dataset etichetat. Trade-off: cost de inference per mesaj
// (~$0.0003 Haiku) vs zero training overhead.
//
// Cache: lista de domenii radacina (10 entries) e citita din DB cu TTL 1h in
// Redis ca sa nu facem query la fiecare clasificare.

import type Anthropic from '@anthropic-ai/sdk';
import { claudeMessages } from './usage.js';
import { extractJsonBlock } from './jsonExtract.js';
import { prisma } from '../prisma.js';
import { redis } from '../redis.js';
import { logger } from '../logger.js';
import { env } from '../../env.js';

const ROOT_DOMAINS_CACHE_KEY = 'topic:root_domains:v1';
const ROOT_DOMAINS_TTL_SEC = 3600;

type RootDomain = { slug: string; name: string };

export type TopicClassification = {
  domain: string | null; // slug sau null daca nu e topic clar
  confidence: number; // 0..1
};

async function loadRootDomains(): Promise<RootDomain[]> {
  // Hot path: incercam din Redis.
  try {
    const cached = await redis.get(ROOT_DOMAINS_CACHE_KEY);
    if (cached) return JSON.parse(cached) as RootDomain[];
  } catch (err) {
    logger.warn({ err }, 'topic.cache_read_failed');
  }

  const rows = await prisma.domain.findMany({
    where: { parentSlug: null, active: true },
    select: { slug: true, name: true },
    orderBy: { sortOrder: 'asc' },
  });
  const data = rows.map((r) => ({ slug: r.slug, name: r.name }));

  // Best-effort cache write.
  try {
    await redis.set(ROOT_DOMAINS_CACHE_KEY, JSON.stringify(data), 'EX', ROOT_DOMAINS_TTL_SEC);
  } catch (err) {
    logger.warn({ err }, 'topic.cache_write_failed');
  }
  return data;
}

const SYSTEM_PROMPT = `Esti un clasificator de topicuri pentru mesajele unui copil 6-14 ani catre pet-ul sau virtual.

Sarcina: dat un mesaj scurt al copilului, identifica DOMENIUL principal din lista oficiala.

REGULI STRICTE:
- Returnezi DOAR JSON, fara explicatii, fara markdown.
- Format exact: {"domain": "<slug>", "confidence": <0..1>}
- "domain" este UN slug exact din lista oficiala SAU null daca mesajul nu se incadreaza clar in niciun domeniu (ex: "salut", "cum esti?", "nu stiu").
- "confidence" reflecta cat de sigur esti (0 = ghicit, 1 = explicit).
- Daca mesajul mentioneaza mai multe domenii, alege-l pe cel dominant.
- Nu fabrica slug-uri noi — daca nimic nu se potriveste clar, return {"domain": null, "confidence": 0}.`;

function buildUserPrompt(message: string, domains: RootDomain[]): string {
  const list = domains.map((d) => `- ${d.slug}: ${d.name}`).join('\n');
  return `Lista oficiala de domenii:
${list}

Mesaj copil: """${message.slice(0, 400)}"""

Returneaza JSON.`;
}

/**
 * Clasifica un mesaj. Returneaza null la orice failure (Claude down, parse fail,
 * slug invalid). Functia NU arunca exceptii — apelantul foloseste defensiv.
 */
export async function classifyTopic(message: string): Promise<TopicClassification | null> {
  if (!message || message.trim().length < 3) return null;

  try {
    const domains = await loadRootDomains();
    if (domains.length === 0) return null;
    const validSlugs = new Set(domains.map((d) => d.slug));

    const completion = await claudeMessages(
      {
        model: env.ANTHROPIC_HINT_MODEL, // Haiku — clasificare scurta, latenta mica
        max_tokens: 80,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(message, domains) }],
      },
      'topic_classify',
    );

    const text = completion.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    const parsed = extractJsonBlock(text);
    if (!parsed || typeof parsed !== 'object') return null;

    const obj = parsed as { domain?: unknown; confidence?: unknown };
    const domain = typeof obj.domain === 'string' ? obj.domain : null;
    const confidence = typeof obj.confidence === 'number' ? obj.confidence : 0;

    if (domain !== null && !validSlugs.has(domain)) {
      logger.warn({ domain, message: message.slice(0, 80) }, 'topic.invalid_slug_returned');
      return { domain: null, confidence: 0 };
    }

    return {
      domain,
      confidence: Math.max(0, Math.min(1, confidence)),
    };
  } catch (err) {
    logger.warn({ err }, 'topic.classify_failed');
    return null;
  }
}
