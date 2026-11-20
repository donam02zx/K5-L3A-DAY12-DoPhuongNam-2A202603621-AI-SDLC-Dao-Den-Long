#!/usr/bin/env bash
# Regenerates Phase 1 evidence in docs/proof/phase-1/. Run from repo root: bash scripts/proof-phase1.sh
set -euo pipefail
D=docs/proof/phase-1
mkdir -p "$D"
H="node src/headless/cli.js"
{
  echo "# Phase 1 proof run — $(node -v), $(uname -s)"
  echo
  echo "## 1. Bot plays full default Night 1 (seeds 1-5), replayed through headless CLI"
  for s in 1 2 3 4 5; do
    node scripts/bot.js "$s" "$D/bot-seed$s.inputs.json" >/dev/null
    $H --seed "$s" --night 1 --inputs "$D/bot-seed$s.inputs.json" --ticks 18000 --out "$D/bot-seed$s.jsonl"
    echo "seed $s: $(grep '"game_over"' "$D/bot-seed$s.jsonl")"
    echo "        $(tail -n 1 "$D/bot-seed$s.jsonl")"
  done
  echo
  echo "## 2. Idle player on default map loses (shades chase and hit)"
  $H --seed 1 --night 1 --ticks 18000 --out "$D/idle-seed1.jsonl"
  grep -E '"player_hit"|"game_over"' "$D/idle-seed1.jsonl"
  tail -n 1 "$D/idle-seed1.jsonl"
  echo
  echo "## 3. Determinism: same seed + inputs twice => identical bytes"
  $H --seed 3 --night 1 --inputs "$D/bot-seed3.inputs.json" --ticks 18000 --out /tmp/ddl-a.jsonl
  $H --seed 3 --night 1 --inputs "$D/bot-seed3.inputs.json" --ticks 18000 --out /tmp/ddl-b.jsonl
  cmp /tmp/ddl-a.jsonl /tmp/ddl-b.jsonl && echo "identical ($(wc -l < /tmp/ddl-a.jsonl) lines)"
  echo
  echo "## 4. Malformed inputs => exit code 2"
  echo '{"frames":[{"tick":5},{"tick":5}]}' > /tmp/ddl-bad.json
  set +e; $H --seed 1 --night 1 --inputs /tmp/ddl-bad.json --ticks 10 --out /tmp/ddl-x.jsonl; echo "exit code: $?"; set -e
  echo
  echo "## 5. Speed: 18000 ticks (full 5-min night)"
  start=$(node -e 'console.log(Date.now())')
  echo '{"random_shades":false}' > /tmp/ddl-noshade.json
  $H --seed 9 --night 1 --ticks 18000 --out /tmp/ddl-speed.jsonl --scenario /tmp/ddl-noshade.json
  echo "$(( $(node -e 'console.log(Date.now())') - start )) ms"
  echo
  echo "## 6. Unit/contract tests"
  npm test --silent 2>&1 | grep -E '^ℹ (tests|pass|fail)'
} 2>&1 | tee "$D/proof-run.txt"
