#!/usr/bin/env bash
# Regenerates Phase 2 evidence in docs/proof/phase-2/. Run from repo root: bash scripts/proof-phase2.sh
# FPS (needs Chrome + built game served on :4173) is separate: npm run build && npx vite preview --port 4173 & node scripts/fps.mjs
set -euo pipefail
D=docs/proof/phase-2
TMP="${TMPDIR:-/tmp}"
mkdir -p "$D"
H="node src/headless/cli.js"
{
  echo "# Phase 2 proof run — $(node -v), $(uname -s)"
  echo
  echo "## 1. Tests (contract v1.1 core + one scenario per new feature)"
  npm test --silent 2>&1 | grep -E '^(✔|✖)|^ℹ (tests|pass|fail)'
  echo
  echo "## 2. Determinism per night (seed 5, random everything, bot inputs) — two runs, byte compare"
  for n in 1 2 3; do
    node scripts/bot.js 5 "$TMP/ddl-bot$n.json" "$n" >/dev/null
    $H --seed 5 --night "$n" --inputs "$TMP/ddl-bot$n.json" --ticks 21600 --out "$TMP/ddl-a$n.jsonl"
    $H --seed 5 --night "$n" --inputs "$TMP/ddl-bot$n.json" --ticks 21600 --out "$TMP/ddl-b$n.jsonl"
    cmp "$TMP/ddl-a$n.jsonl" "$TMP/ddl-b$n.jsonl" && echo "night $n: identical ($(wc -l < "$TMP/ddl-a$n.jsonl") lines)"
  done
  echo
  echo "## 3. Speed: full night, max 21600 ticks (limit 30 s); player invulnerable so the run is not cut short"
  echo '{"player":{"invuln_ticks":30000}}' > "$TMP/ddl-inv.json"
  for n in 1 2 3; do
    start=$(node -e 'console.log(Date.now())')
    $H --seed 7 --night "$n" --ticks 21600 --scenario "$TMP/ddl-inv.json" --out "$TMP/ddl-speed.jsonl"
    echo "night $n: $(( $(node -e 'console.log(Date.now())') - start )) ms, $(tail -n 1 "$TMP/ddl-speed.jsonl")"
  done
  echo
  echo "## 4. Greedy bot vs standard numbers (honest result: it does NOT win yet)"
  for n in 1 2 3; do for s in 1 2 3; do node scripts/bot.js "$s" "$TMP/ddl-bot.json" "$n" | sed 's/"result":{[^}]*},//'; done; done
  echo
  echo "## 5. Malformed scenario => exit 2"
  echo '{"shades":[{"pos":[0,0,0],"state":"angry"}]}' > "$TMP/ddl-bad.json"
  set +e; $H --seed 1 --night 2 --scenario "$TMP/ddl-bad.json" --ticks 10 --out "$TMP/ddl-x.jsonl"; echo "exit code: $?"; set -e
} 2>&1 | tee "$D/proof-run.txt"
