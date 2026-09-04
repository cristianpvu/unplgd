import { appendFile } from 'node:fs/promises';

// Instrumentare pentru evaluarea adversariala a pragurilor anti-cheat
// (articol GEBA 2026). Activata doar cu COWALK_TRACE=1 — in productie
// nu scrie nimic si nu costa nimic.
//
// Principiu: NU agregam nimic aici. Scriem batch-ul de RSSI exact asa cum a
// ajuns de la mobil, cu timpul de sosire. Toata agregarea (stddev, ferestre,
// baleiaj de prag) se face offline in scripts/analyze_trace.py, ca sa poti
// re-analiza aceleasi date cu alt prag fara sa refaci sesiunile pe teren.
//
// Rulare pe teren, o conditie experimentala per pornire de server:
//   COWALK_TRACE=1 COWALK_TRACE_LABEL=A3a_rucsac npm run dev

const ENABLED = process.env.COWALK_TRACE === '1';
const FILE = process.env.COWALK_TRACE_FILE ?? './cowalk-trace.jsonl';

export const traceEnabled = ENABLED;
export const traceFile = FILE;

// Eticheta conditiei experimentale curente. Pornim de la env, dar se schimba
// in zbor prin GET /admin/trace?key=...&label=... — pe teren, cu doua telefoane
// in mana, nu vrei sa repornesti containerul intre conditii.
let currentLabel = process.env.COWALK_TRACE_LABEL ?? 'unlabeled';
let rowsWritten = 0;

export function setTraceLabel(label: string): string {
  currentLabel = label.trim() || 'unlabeled';
  return currentLabel;
}

export function traceStatus() {
  return { enabled: ENABLED, label: currentLabel, file: FILE, rowsWritten };
}

type Row =
  | {
      kind: 'report';
      t: number;
      label: string;
      sessionId: string;
      userId: string;
      // Pasi cumulati de la inceputul sesiunii, asa cum ii raporteaza mobilul.
      steps: number;
      // Batch-ul brut acumulat de la raportul anterior (~30s de scan-uri).
      rssi: number[];
    }
  | {
      kind: 'verdict';
      t: number;
      label: string;
      sessionId: string;
      userId: string;
      // 'award' = a trecut anti-cheat-ul; altfel motivul respingerii.
      outcome: 'award' | 'steps' | 'rssi_static' | 'rssi_samples';
      steps: number;
      samples: number;
      stdDev: number;
      effectiveMs: number;
    };

// Fire-and-forget: o eroare de scriere in trace nu are voie sa doboare o
// sesiune reala. Serializam prin lant de promisiuni ca liniile sa nu se
// intercaleze intre ele la scrieri concurente.
let chain: Promise<void> = Promise.resolve();

function write(row: Row): void {
  if (!ENABLED) return;
  rowsWritten++;
  chain = chain
    .then(() => appendFile(FILE, JSON.stringify(row) + '\n'))
    .catch((e) => {
      console.warn('[cowalk-trace] write failed:', e);
    });
}

export function traceReport(
  sessionId: string,
  userId: string,
  steps: number,
  rssi: number[],
): void {
  write({ kind: 'report', t: Date.now(), label: currentLabel, sessionId, userId, steps, rssi });
}

export function traceVerdict(args: {
  sessionId: string;
  userId: string;
  outcome: 'award' | 'steps' | 'rssi_static' | 'rssi_samples';
  steps: number;
  samples: number;
  stdDev: number;
  effectiveMs: number;
}): void {
  write({ kind: 'verdict', t: Date.now(), label: currentLabel, ...args });
}
