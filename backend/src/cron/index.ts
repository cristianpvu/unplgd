// Cron jobs in-proces — node-cron ruleaza pe acelasi event loop ca Express.
// Toate job-urile sunt fire-and-forget catre functii idempotente: daca proces-ul
// crapa si reporneste tarziu (de exemplu la 09:15 cand era 08:00), nu se
// "double-run" pentru ca functiile au cache-ul/idempotenta lor (cooldown pe
// notificari, cache Redis pe aggregates).
//
// Time zone: TOATE job-urile in Europe/Bucharest. Asa "8 dimineata" inseamna
// 8 dimineata pentru user-ul roman, indiferent de tz-ul container-ului.
//
// Pornite din server.ts:
//   import { startCronJobs } from './cron/index.js';
//   startCronJobs();

import cron from 'node-cron';
import { logger } from '../lib/logger.js';
import { getParkAggregates } from '../lib/social/parkAggregates.js';
import { runNotifyParkHints } from '../lib/social/notifyParkHints.js';
import { rebuildDomainTransitionMatrix } from '../lib/social/markov.js';

type JobDef = {
  name: string;
  schedule: string; // crontab format
  fn: () => Promise<unknown>;
};

const JOBS: JobDef[] = [
  // 06:15 — rebuild matrix Markov de tranzitii pe root domains. Cache 24h,
  // citita la fiecare apel de story create/extend pt a injecta predictia in
  // naratorul Claude. Rulam inainte de park_aggregates ca sa fim siguri ca-i
  // gata cand vine valul de useri dimineata.
  {
    name: 'markov_matrix_rebuild',
    schedule: '15 6 * * *',
    fn: async () => {
      const m = await rebuildDomainTransitionMatrix();
      logger.info(
        { users: m.totalUsers, transitions: m.totalTransitions, rows: Object.keys(m.rows).length },
        'cron.markov_matrix_rebuilt',
      );
    },
  },

  // 06:30 — preincalzim cache-ul de aggregates. Asa notify-ul de 08:00 (si
  // primele requests ale user-ilor) au date fresh fara latenta de fetch.
  {
    name: 'park_aggregates_refresh',
    schedule: '30 6 * * *',
    fn: async () => {
      const data = await getParkAggregates({ forceFresh: true });
      logger.info({ slots: data.slots.length }, 'cron.park_aggregates_refreshed');
    },
  },

  // 08:00 — creeaza notificari de tip park_hint pt useri activi care au
  // match decent. Cooldown saptamanal si pe slot in logica notificatorului.
  {
    name: 'notify_park_hints',
    schedule: '0 8 * * *',
    fn: async () => {
      const result = await runNotifyParkHints();
      logger.info({ result }, 'cron.notify_park_hints_done');
    },
  },
];

let started = false;

/**
 * Porneste toate job-urile cron. Idempotent — apel dublu nu creeaza
 * task-uri duplicate. De apelat o singura data din server.ts dupa app.listen.
 */
export function startCronJobs(): void {
  if (started) return;
  started = true;

  for (const job of JOBS) {
    cron.schedule(
      job.schedule,
      async () => {
        const startedAt = Date.now();
        logger.info({ job: job.name }, 'cron.job_start');
        try {
          await job.fn();
          logger.info(
            { job: job.name, durationMs: Date.now() - startedAt },
            'cron.job_success',
          );
        } catch (err) {
          logger.error(
            { err, job: job.name, durationMs: Date.now() - startedAt },
            'cron.job_failed',
          );
        }
      },
      { timezone: 'Europe/Bucharest' },
    );
    logger.info({ job: job.name, schedule: job.schedule }, 'cron.job_registered');
  }

  logger.info({ jobsCount: JOBS.length }, 'cron.started');
}
