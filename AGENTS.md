# AGENTS.md — Đảo Đèn Lồng

3D third-person game, Three.js + Vite, Node >= 20. Lab docs: `docs/lab/`.

## Commands
- Install: `npm ci`
- Test (must pass before finishing any task): `npm test`
- Headless: `npm run headless -- <scenario.json>`
- Dev server: `npm run dev` · Build: `npm run build`

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
