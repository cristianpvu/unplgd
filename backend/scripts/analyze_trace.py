#!/usr/bin/env python3
"""Analiza offline a trace-ului de co-walk pentru evaluarea adversariala.

    python3 scripts/analyze_trace.py cowalk-trace.jsonl

Citeste JSONL-ul produs de src/lib/cowalk/trace.ts si raporteaza, per conditie
experimentala:
  - statistica descriptiva a fiecarei sesiuni (n samples, rata, medie, stddev)
  - verdictul la pragurile curente
  - un baleiaj de prag pe stddev, cu rata de fals-accept si fals-reject
  - o statistica alternativa (mediana stddev-urilor pe ferestre de 60s), care
    e mai greu de pacalit cu excursii rare decat stddev-ul pooled

Conventie de etichetare: numele conditiei incepe cu 'L' pentru legitim si cu
'A' pentru atac (L1_plimbare, A3a_rucsac, ...). Scriptul nu ghiceste — daca
eticheta nu incepe cu L sau A, sesiunea e raportata dar exclusa din ratele
agregate.
"""

import json
import math
import statistics
import sys
from collections import defaultdict

# Trebuie sa ramana sincronizate cu src/lib/cowalk/session.ts.
MIN_DURATION_MS = 10 * 60 * 1000
MIN_STEPS = 100
MIN_RSSI_STDDEV_DBM = 1.5
MIN_RSSI_SAMPLES = 30
WINDOW_MS = 60_000


def stddev(xs):
    """Populational, ca in backend (imparte la n, nu la n-1)."""
    if len(xs) < 2:
        return 0.0
    m = sum(xs) / len(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / len(xs))


def load(path):
    """Grupeaza randurile pe (label, sessionId, userId)."""
    runs = defaultdict(lambda: {"reports": [], "verdict": None})
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            key = (r["label"], r["sessionId"], r["userId"])
            if r["kind"] == "report":
                runs[key]["reports"].append(r)
            else:
                runs[key]["verdict"] = r
    for run in runs.values():
        run["reports"].sort(key=lambda r: r["t"])
    return runs


def summarise(reports):
    """Reconstruieste seria de samples cu timpi aproximativi.

    Mobilul trimite un batch la ~30s fara timestamp per sample, deci
    interpolam uniform in intervalul dintre doua rapoarte consecutive. E
    suficient pentru ferestre de 60s; nu pretinde rezolutie mai fina.
    """
    samples = []  # (t_ms, rssi)
    prev_t = reports[0]["t"] - 30_000 if reports else 0
    for r in reports:
        batch = r["rssi"]
        span = max(1, r["t"] - prev_t)
        for i, v in enumerate(batch):
            samples.append((prev_t + span * (i + 1) / len(batch), v))
        prev_t = r["t"]
    return samples


def windowed_stddev(samples):
    """Mediana stddev-urilor pe ferestre de 60s.

    Motivul: stddev-ul pooled poate fi umflat de cateva excursii rare (cineva
    trece pe langa doua telefoane lasate pe masa). Mediana pe ferestre cere ca
    variatia sa fie *sustinuta*, nu ocazionala.
    """
    if not samples:
        return 0.0
    t0 = samples[0][0]
    buckets = defaultdict(list)
    for t, v in samples:
        buckets[int((t - t0) // WINDOW_MS)].append(v)
    per_window = [stddev(vs) for vs in buckets.values() if len(vs) >= 5]
    return statistics.median(per_window) if per_window else 0.0


def main(path):
    runs = load(path)
    if not runs:
        print("Trace gol.")
        return

    rows = []
    for (label, sid, uid), run in sorted(runs.items()):
        reports = run["reports"]
        if not reports:
            continue
        samples = summarise(reports)
        vals = [v for _, v in samples]
        dur_ms = reports[-1]["t"] - reports[0]["t"] + 30_000
        steps = max(r["steps"] for r in reports)
        rows.append(
            {
                "label": label,
                "sid": sid[:8],
                "uid": uid[:8],
                "n": len(vals),
                "rate": len(vals) / (dur_ms / 60_000) if dur_ms else 0,
                "mean": sum(vals) / len(vals) if vals else 0,
                "sd": stddev(vals),
                "sd_win": windowed_stddev(samples),
                "steps": steps,
                "dur_min": dur_ms / 60_000,
                "verdict": run["verdict"]["outcome"] if run["verdict"] else "-",
                "vals": vals,
            }
        )

    print(f"\n{'='*104}\nSESIUNI ({len(rows)})\n{'='*104}")
    hdr = f"{'conditie':<20}{'sesiune':<10}{'n':>6}{'n/min':>8}{'RSSI med':>10}{'sd':>8}{'sd_win':>9}{'pasi':>7}{'min':>7}  verdict"
    print(hdr)
    print("-" * 104)
    for r in rows:
        print(
            f"{r['label']:<20}{r['sid']:<10}{r['n']:>6}{r['rate']:>8.1f}"
            f"{r['mean']:>10.1f}{r['sd']:>8.2f}{r['sd_win']:>9.2f}"
            f"{r['steps']:>7}{r['dur_min']:>7.1f}  {r['verdict']}"
        )

    legit = [r for r in rows if r["label"].upper().startswith("L")]
    attack = [r for r in rows if r["label"].upper().startswith("A")]
    skipped = len(rows) - len(legit) - len(attack)
    if skipped:
        print(f"\n({skipped} sesiuni fara eticheta L*/A* — excluse din rate.)")
    if not legit or not attack:
        print("\nNu am si conditii legitime si conditii de atac — sar peste baleiaj.")
        return

    def passes(r, thr, stat):
        return (
            r["dur_min"] * 60_000 >= MIN_DURATION_MS
            and r["steps"] >= MIN_STEPS
            and r["n"] >= MIN_RSSI_SAMPLES
            and r[stat] >= thr
        )

    for stat, name in (("sd", "stddev pooled (implementarea actuala)"),
                       ("sd_win", "mediana stddev pe ferestre de 60s")):
        print(f"\n{'='*104}\nBALEIAJ DE PRAG — {name}\n{'='*104}")
        print(f"{'prag dBm':>10}{'fals accept':>14}{'fals reject':>14}   (atacuri acceptate / intalniri legitime respinse)")
        print("-" * 104)
        thr = 0.5
        while thr <= 4.001:
            fa = sum(1 for r in attack if passes(r, thr, stat))
            fr = sum(1 for r in legit if not passes(r, thr, stat))
            mark = "  <- prag curent" if abs(thr - MIN_RSSI_STDDEV_DBM) < 1e-9 else ""
            print(
                f"{thr:>10.1f}{fa:>7}/{len(attack):<6}{fr:>7}/{len(legit):<6}"
                f"{fa/len(attack)*100:>8.0f}%{fr/len(legit)*100:>8.0f}%{mark}"
            )
            thr += 0.25


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
