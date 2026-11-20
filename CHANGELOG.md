# Changelog

## [v1.0.0 / phase-4] Ticket-04 "Bình minh" (Contract v1.3)
### Added
- **Benchmark** `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json`: Chrome app window 1280×720 with vsync off, standard scene (200 wandering shades, 100 motes, L1–L3 lit, orbit camera r=30 m, Y=15, 15 s per lap), 3 s warm-up, writes avg/p1-low FPS, p95 frame time, load time and peak RSS. Core `createBenchSim` disables spawning, damage, pickup, fuel decay and night end.
- **Soak** `node --expose-gc scripts/soak.mjs --seed 7 --nights 10 --out soak.json`: 10 nights in one process with seeded random input, RSS start/end (+ heap).
- **Local leaderboard**: top 10 stored on disk (`~/.dao-den-long/leaderboard.json`) by the launcher `scripts/serve.mjs`, with a localStorage fallback. Name entry after Dawn or after a loss, a leaderboard screen, and `--export-leaderboard out.json`. Names may use Vietnamese diacritics.
- **Accessibility**: remap every action (duplicate detection, reset to defaults, persisted), captions plus an edge arrow when a shade spawns, wind/10 s/low-fuel captions, reduce motion (no camera shake or screen flash), minimum 18 px text and a large-text ×1.25 option.
- `game.contract.json` v1.3 with `bench_cmd`, `soak_cmd`. `run_cmd` is now `node scripts/serve.mjs` (`npm start`).
- GitHub Release v1.0.0 with a self-contained web build zip (Node ≥ 20 only, no npm install).
- `scripts/ui-smoke.mjs` (DevTools UI smoke test), `tests/phase4.test.js`.
### Changed
- Shades and motes are rendered with GPU instancing. Wander-target candidate lists are built once per tick (same results, less garbage).
- All v1.0–v1.2 rules are unchanged (no breaking changes in this phase).

## [phase-3] Ticket-03 "Đèn cạn dầu" (Contract v1.2)

### ⚠ Breaking changes
- `contract_version` is `"1.2"`. Night durations change to **240 / 270 / 300 s** (were 300 / 330 / 360).
- **Win rule replaced:** there is no early win when all lanterns are lit. The night always runs to dawn. Winning needs ≥ ceil(0.6 × lanterns) lit at the last tick. `game_over.reason` gains `dawn_survived`; **`all_lit` is no longer emitted**.
- **Lantern model:** lit lanterns burn fuel (1/s) and go out at 0 (`lantern_out`, `deposited` reset to 0). Lit lanterns now **accept motes again** (refuel). Interaction targets any acceptable lantern, not only unlit ones.
- **Safe zone** only exists while `fuel ≥ 30` (it used to be "always while lit").
- **Scoring replaced:** +5 per mote deposited or refuelled (was +10), +100 first light, +40 relight, +5 per stunned shade or +15 if it was draining, and at a dawn win +50 + floor(fuel) per lit lantern and +50 per flame. The **time bonus is removed** (`per_second_left` is 0).
- **Carry capacity** is no longer constant: 10 + 2 × successful lights, max 20.
- New shade state **`drain`**.
- Snapshot additions: `lanterns[].fuel/ever_lit/relit_count`, `player.capacity`.
- Scenario additions: `lanterns[].fuel/ever_lit`, `player.successful_lights`, `shades[].target_lantern_id`. A `lit: true` lantern without `fuel` defaults to 100.
- New events: `refuel`, `lantern_out`, `fuel_drain` (every 60 drain ticks). `lantern_lit` gains `relight`.

### Added
- Colour-blind palette setting (saved): shade rim/eyes `#00B3FF`, UI danger `#FFFFFF` + ⚠.
- Fuel bar on lit lanterns with a 1 Hz blink below 30. Unlit lanterns are squashed 20%, and lanterns that went out show torn paper.
- HUD shows lit/needed, carried/capacity, and "E — Châm dầu / Thắp lại" prompts.
- `docs/adr/0001-lantern-fuel-and-dawn-win.md`, `tests/phase3.test.js`.

## [phase-2] Ticket-02 (Contract v1.1)
### ⚠ Breaking changes
- All self-chosen Phase 1 numbers replaced by the standard numbers (capacity 10, lantern cost 10, pulse cost 3 / radius 5, shade speed 4, …).
- Score per mote moves from pickup to **deposit**. `fall_enabled` is now true (falling costs a flame).
- Shade states are now `spawning/wander/chase/recoil/stunned`; `night_start` is emitted at tick 0.
### Added
- Nights 2 (two islands + bamboo bridge, bounce pads) and 3 (3 tiers, ramps, bell tower, wind); dash; Gió Lạc; Bùa Gió; pause; menu, night intro, result and dawn screens; settings; WebAudio sound; full HUD; standard palette.

## [phase-1] PRD-0 (Contract v1.0)
### Added
- First playable Night 1 (Three.js), deterministic core, headless runner per Test Contract v1.0, `game.contract.json`, 23 contract tests, proof script.
