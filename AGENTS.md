# AGENTS.md — Đảo Đèn Lồng

3D third-person game, Three.js + Vite, Node >= 20. Lab docs: `docs/lab/`.

## Commands
- Install: `npm ci`
- Test (must pass before finishing any task): `npm test`
- Headless: `node src/headless/cli.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`
- Phase proof (run before tagging): `bash scripts/proof-phase1.sh`
- Dev server: `npm run dev` · Build: `npm run build`
- Gameplay numbers live ONLY in `src/core/tuning.js`; mirror them into `game.contract.json` (a test enforces equality).
- Tests go through the CLI (`tests/helpers.js runHeadless`). Use `quiet()` scenarios — default random shades kill an idle player in ~14 s.

## Architecture (do not break)
- `src/core/` = pure game logic. No DOM, no `three`, no `Math.random`, no `Date.now`. Use `makeRng(seed)`.
- `src/render/` = Three.js view. Reads sim state, never owns game rules.
- `src/headless/` = Test Contract entry point. Output format must match the contract byte-for-byte.
- Fixed timestep: render loop and headless both call `step()` once per tick.

## Rules
- Only implement what the current phase doc says. Ambiguity → write an assumption in `docs/notes/assumptions.md`, don't invent.
- Every requirement gets a row in `docs/proof/README.md` (requirement, how verified, evidence, result).
- Never hand-edit evidence output; never write tests that always pass.
- When a new phase overrides an old rule: update or remove the old test WITH a reason in the notes.
- Small commits, one change each.
