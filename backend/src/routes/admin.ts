import { Router } from 'express';
import { env } from '../env.js';
import { getUsageStats } from '../lib/ai/usage.js';
import { rebuildGraphFromScratch } from '../lib/graphSync.js';
import { getParkAggregates } from '../lib/social/parkAggregates.js';
import { runNotifyParkHints } from '../lib/social/notifyParkHints.js';
import {
  getDomainTransitionMatrix,
  rebuildDomainTransitionMatrix,
  predictNextRootDomain,
} from '../lib/social/markov.js';
import { runNotifyDailyQuests } from '../lib/quests/notify.js';

// Endpoint-uri pentru debug rapid (browser-friendly, fara JWT). Pazite cu
// ADMIN_KEY din env — query param ?key=<secret>. Daca lipseste cheia, raspund
// 503 ca sa nu fie accidental expus.
export const adminRouter = Router();

function checkKey(req: any, res: any): boolean {
  if (!env.ADMIN_KEY) {
    res.status(503).json({ error: 'admin_disabled', message: 'ADMIN_KEY nu e setat' });
    return false;
  }
  const provided = req.query?.key;
  if (provided !== env.ADMIN_KEY) {
    res.status(401).json({ error: 'bad_key' });
    return false;
  }
  return true;
}

// GET /admin/ai-usage?key=<secret>
// Browser-friendly HTML implicit; daca pui &format=json primesti raw JSON.
adminRouter.get('/ai-usage', async (req, res, next) => {
  try {
    if (!checkKey(req, res)) return;
    const stats = await getUsageStats(60);

    if (req.query.format === 'json') {
      res.json(stats);
      return;
    }

    const dailyRows = Object.entries(stats.daily)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(
        ([day, d]) => `
        <tr>
          <td>${day}</td>
          <td>${d.calls}</td>
          <td>${d.inputTokens.toLocaleString()}</td>
          <td>${d.outputTokens.toLocaleString()}</td>
          <td>$${d.costUsd.toFixed(4)}</td>
        </tr>`,
      )
      .join('');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <title>AI Usage — unplgd</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #2D2A4A; }
    h1 { font-size: 22px; }
    .total { background: #FFF4C2; padding: 16px; border-radius: 12px; margin: 18px 0; }
    .big { font-size: 32px; font-weight: 800; color: #FF7A59; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #EFE4B2; font-size: 13px; }
    th { background: #FFF8E0; font-weight: 700; }
    td:nth-child(n+2), th:nth-child(n+2) { text-align: right; }
    .muted { color: #7A7896; font-size: 12px; }
  </style>
</head>
<body>
  <h1>AI Usage</h1>
  <div class="total">
    <div class="muted">Total cost (toate apelurile Claude)</div>
    <div class="big">$${stats.totalCostUsd.toFixed(4)}</div>
    <div class="muted">${stats.totalCalls} apeluri · ${stats.totalInputTokens.toLocaleString()} input tokens · ${stats.totalOutputTokens.toLocaleString()} output tokens</div>
  </div>
  <table>
    <thead>
      <tr><th>Zi</th><th>Apeluri</th><th>Input tok</th><th>Output tok</th><th>Cost</th></tr>
    </thead>
    <tbody>${dailyRows || '<tr><td colspan="5" class="muted">Niciun consum inregistrat inca.</td></tr>'}</tbody>
  </table>
  <p class="muted">Adauga <code>&amp;format=json</code> pentru date raw.</p>
</body>
</html>`);
  } catch (e) {
    next(e);
  }
});

// POST /admin/graph/rebuild?key=<secret>
// Sterge graful Neo4j si il reconstruieste din Postgres. Folosit cand sync-ul
// incremental a esuat (Neo4j down) sau dupa schimbari in schema graf. Returneaza
// numarul de noduri si edges create.
adminRouter.post('/graph/rebuild', async (req, res, next) => {
  try {
    if (!checkKey(req, res)) return;
    const result = await rebuildGraphFromScratch();
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// GET /admin/social/park-aggregates?key=<secret>[&fresh=1]
// Inspecteaza matricea agregata (park × day × hour × profile). Util pt
// debug + verificat ca avem destule date inainte de a notifica useri.
adminRouter.get('/social/park-aggregates', async (req, res, next) => {
  try {
    if (!checkKey(req, res)) return;
    const fresh = req.query.fresh === '1';
    const data = await getParkAggregates({ forceFresh: fresh });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

// POST /admin/social/notify-park-hints?key=<secret>
// Ruleaza notificatorul pe TOTI userii activi. Cron-ul daily il apeleaza la
// 08:00 Europe/Bucharest. Endpoint ramane pt trigger manual / debug.
adminRouter.post('/social/notify-park-hints', async (req, res, next) => {
  try {
    if (!checkKey(req, res)) return;
    const result = await runNotifyParkHints();
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// GET /admin/markov/matrix?key=<secret>[&fresh=1]
// Inspecteaza matricea de tranzitii pe root domains. Util ca sa vezi ce
// directii sunt populare in cohorta inainte ca naratorul sa injecteze
// predictia in povesti.
adminRouter.get('/markov/matrix', async (req, res, next) => {
  try {
    if (!checkKey(req, res)) return;
    const fresh = req.query.fresh === '1';
    const m = await getDomainTransitionMatrix({ forceFresh: fresh });
    res.json(m);
  } catch (e) {
    next(e);
  }
});

// POST /admin/markov/rebuild?key=<secret>
// Rebuild brute al matricii (sare peste cache). Cron-ul de 06:15 il face zilnic.
adminRouter.post('/markov/rebuild', async (req, res, next) => {
  try {
    if (!checkKey(req, res)) return;
    const m = await rebuildDomainTransitionMatrix();
    res.json({
      builtAt: m.builtAt,
      totalUsers: m.totalUsers,
      totalTransitions: m.totalTransitions,
      rowsCount: Object.keys(m.rows).length,
    });
  } catch (e) {
    next(e);
  }
});

// POST /admin/quests/notify?key=<secret>
// Trimite notificarile "taskuri noi" pe toti userii activi. Cron-ul ruleaza
// la 09:00 Bucharest. Idempotent pe zi.
adminRouter.post('/quests/notify', async (req, res, next) => {
  try {
    if (!checkKey(req, res)) return;
    const result = await runNotifyDailyQuests();
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// GET /admin/markov/predict?key=<secret>&userId=<id>
// Debug — vezi ce predictie ar primi un user concret. Acelasi rezultat care
// ajunge in storyPrompts ca predictedNextDomain.
adminRouter.get('/markov/predict', async (req, res, next) => {
  try {
    if (!checkKey(req, res)) return;
    const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
    if (!userId) {
      res.status(400).json({ error: 'userId required' });
      return;
    }
    const prediction = await predictNextRootDomain(userId);
    res.json({ userId, prediction });
  } catch (e) {
    next(e);
  }
});
