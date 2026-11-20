# ADR 0001: Lantern fuel state model and dawn win (Ticket-03)

- **Status:** Accepted (Phase 3, 2026-11-20)
- **Replaces:** the Phase 1–2 rules "a lit lantern never changes", "shades never enter a safe zone" and "win when all lanterns are lit"

## Context
Ticket-03 ("Đèn cạn dầu") changes the core loop. Lanterns can now go out. The goal moves from "light everything" to "keep enough lanterns lit until dawn". Until Phase 2 a lantern was `{lit, deposited}`, the safe zone was simply `lit`, and the night ended as soon as every lantern was lit.

## Decision
1. **Lantern state** is now `{lit, deposited, fuel, everLit, relitCount}`:
   - `fuel` is stored as an **integer in 1/60 units** (max 6000), so 1 fuel/s decay is exactly 1 unit per tick and drain is 5 units per tick per shade. There is no float drift; values are rounded to 1 decimal only in output.
   - Transitions:
     - `unlit --(deposit ≥ cost)--> lit(fuel=100)`, where cost = 10, or 5 if `everLit`
     - `lit --(fuel ≤ 0, checked right after step 2)--> unlit(deposited=0, everLit=true)`
     - `lit --(refuel)--> lit`
2. **Safe zone** is a derived predicate `protects(L) = L.lit && L.fuel ≥ 30`. Exactly 30 still protects. Every safe-zone check (blocking, shade spawn validity) goes through it. When a lantern becomes protective again (it was just lit, or was refuelled from below 30 to 30 or more), shades inside are evicted over 30 ticks and are harmless meanwhile. This reuses the Phase 2 eviction code.
3. **Interaction** picks the nearest *acceptable* lantern (unlit, or lit and not full; tie goes to the smaller id). On an unlit lantern it deposits; on a lit one it refuels with `used = min(carried, ceil((100 − fuel)/10))`. A full lantern (`used = 0`) is never chosen.
4. **Shade state machine** gains `drain`:
   - `wander` targets the nearest weak lantern (lit, fuel < 30), otherwise the nearest unlit lantern, otherwise it roams.
   - Within 2 m of a weak lantern it switches to `drain`.
   - `drain` exits to: `chase` (Mây within 6 m), `stunned` (pulse, +15 instead of +5), or `wander` (lantern out, fuel ≥ 30, or more than 2 m away).
   - Drain is applied in step 2, together with decay. `fuel_drain` is emitted every 60 drain ticks.
5. **Win rule:** no early win. The night always runs to dawn. At the end of a tick: `flames ≤ 0` → lost `no_flames` (always first). Otherwise, at time 0: lit count ≥ ceil(0.6 × n) → won `dawn_survived`, else lost `dawn`.
6. **Capacity** = min(20, 10 + 2 × successfulLights), counted per night. Lanterns pre-lit by a scenario do not count.
7. **Scoring:** the 5 contract score keys stay in `tuning.score`: `per_mote` 5, `per_second_left` 0 (time bonus removed). The extra Ticket-03 values (+40 relight, +15 stun while draining, +50 + floor(fuel) per lit lantern at dawn) live in `SPEC.score3`, so the contract `score` object keeps its v1.0 shape.

## Consequences
- Tests that encoded replaced rules were **updated or deleted with a reason** (see the header of `tests/contract.test.js`). New rules are covered in `tests/phase3.test.js` (12 tests).
- The Phase 2 "drifter / charm / pause / maps" behaviour is unchanged, and those tests still pass.
- The greedy bot is not updated for the new loop (it was already not winning with the Phase 2 numbers).
- The renderer now shows a fuel bar, a 1 Hz blink below 30, squashed and torn unlit lanterns, and the capacity bar. It also has a colour-blind palette setting.
