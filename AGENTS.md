# AGENTS.md — Đảo Đèn Lồng

3D third-person game, Three.js + Vite, Node >= 20. Lab docs: `docs/lab/`. Current scope: Ticket-04 / Test Contract **v1.3** (release: bench, soak, leaderboard, accessibility). Design: `docs/adr/`. Breaking changes: `CHANGELOG.md`.

## Commands
- Install: `npm ci` · Test (must pass before finishing any task): `npm test`
- Headless: `node src/headless/cli.js --seed 1 --night <1|2|3> --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`
- Verify before tagging: skill `.claude/skills/verify-phase` (proof script `bash scripts/proof-phase2.sh`, FPS `scripts/fps.mjs`)
- Run game: `npm start` (scripts/serve.mjs: build + serve + on-disk leaderboard) · Bench: `npm run build && npm run bench` · Soak: `npm run soak` · UI smoke: `node scripts/ui-smoke.mjs`
- Dev: `npm run dev` · Build: `npm run build` · Debug URL params: `?auto=1&night=N&seed=S&lit=K&fps=1`

## Architecture (do not break)
- `src/core/` = pure logic. No DOM, no `three`, no `Math.random`, no `Date`. Use `s.rng`.
  - `tuning.js`: ALL numbers (TUNING = contract keys, SPEC = other Ticket-02 constants). Mirror TUNING into `game.contract.json` (a test enforces it).
  - `maps.js`: standard maps (ground height function, lanterns, spawn points, pads, charms). Angles: (r cos a, y, r sin a).
  - Lantern fuel is an INTEGER in 1/60 units (`FU`); only round on output. Safe zone = `protects(L)` (lit && fuel >= 30); never test `L.lit` alone for safety.
  - `sim.js`: `step()` follows the Ticket-02 tick order EXACTLY (+ Ticket-03: fuel decay/drain and lantern_out at end of step 2) (pause → counters → move/fall → pickup → interact → safe zones → pulse → move enemies → touches → spawns → win/lose). Keep the numbered comments.
- `src/render/` = Three.js + DOM UI + WebAudio. Reads sim state, never owns rules. Extra creative content must not change headless output.
- `src/headless/cli.js` = contract entry. Validation error → exit 2 + stderr.

## Rules
- Only implement what the phase doc says. Ambiguity → assumption in `docs/notes/assumptions.md` (flag it to the user to ask the TA).
- Every requirement has a row in `docs/proof/README.md`. Acceptance criteria for Phase 2 are in `docs/notes/spec-phase2.md`.
- Tests go through the CLI. Use `quiet()` scenarios: default random shades/drifters/charms interfere (e.g. charm C1 sits on the Night 2 bridge).
- Never hand-edit evidence. Never write tests that always pass. When a ticket overrides a rule, fix or remove the old test WITH a reason.
- Small commits, one change each. Ask before push/tag.
- Editing by string replacement: make the anchor UNIQUE (a repeated anchor once inserted code inside an event handler). Run `node scripts/ui-smoke.mjs` after UI changes.
- Bench scene (`createBenchSim`) must stay standard: no creative extras, no gameplay changes outside `s.bench` guards.
