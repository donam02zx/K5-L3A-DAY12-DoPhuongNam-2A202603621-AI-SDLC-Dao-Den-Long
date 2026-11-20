---
name: verify-phase
description: Run the full verification for the current phase (tests through the headless CLI, proof script, optional FPS) and update docs/proof. Use before tagging a phase or after changing src/core.
---

# Verify a phase

1. `npm test`. All tests must pass. Tests drive the real CLI (`tests/helpers.js` `runHeadless`), the same way the grader does.
   - For a new rule, add a scenario with `quiet({...})` (no random spawns, no wind) and assert on events and snapshots.
   - If a new ticket replaces an old rule, fix or delete the old test AND write the reason in the test file header + `docs/notes/assumptions.md`.
2. `bash scripts/proof-phase<N>.sh`. Regenerates `docs/proof/phase-<N>/proof-run.txt` (determinism byte-compare per night, full-night speed, bot, exit codes).
3. FPS (render changes only): `npm run build`, then `npx vite preview --port 4173` in the background, then `node scripts/fps.mjs > docs/proof/phase-<N>/fps.json`. Stop the server afterwards.
4. Screenshots: headless Chrome `--screenshot` on `http://localhost:4173/?auto=1&night=N&seed=1[&lit=K]`. Do NOT use `--virtual-time-budget` (it hangs because of the render loop).
5. Update `docs/proof/README.md` (requirement → how → evidence → result). Write "chưa đạt" honestly. Never hand-edit generated output.
6. Only then: commit, tag `phase-N`, push (ask the user first).
