# Changelog

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
- Standard numbers, 3 nights, dash, falls, Gió Lạc, Bùa Gió, wind, pause, full UI (see `docs/notes/spec-phase2.md`).

## [phase-1] PRD-0 (Contract v1.0)
- First playable Night 1, headless runner.
