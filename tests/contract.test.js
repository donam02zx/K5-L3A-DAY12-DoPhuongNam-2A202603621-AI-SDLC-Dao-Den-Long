// Core rules, Test Contract v1.1 (Phase 1 rules re-checked with Ticket-02 standard numbers).
// Changed vs phase-1 tests (reason: Ticket-02 replaced the rule):
//  - pickup gives no score; +10 per mote DEPOSITED
//  - shades only chase within 12 m (wander otherwise); speed 4 m/s; states spawning/wander/chase/recoil/stunned
//  - pulse: cost 3, 3D radius 5 from feet+0.8, stun 120 ticks, push 4 m over 15 ticks
//  - fall is enabled (replaces "fall disabled" test)
//  - hit drops motes onto the ground (kind "dropped") instead of deleting them
//  - night_start event at tick 0 is now always emitted
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TUNING as T } from '../src/core/tuning.js';
import { createSim, step } from '../src/core/sim.js';
import { runHeadless, quiet, ev, close as closeA, press } from './helpers.js';

const close = (a, b, eps) => closeA(assert, a, b, eps);
const lit = (ids) => ids.map((id) => ({ id, lit: true }));
const OTHERS_LIT = lit(['L2', 'L3', 'L4', 'L5']);

test('A: game.contract.json v1.1 tuning matches the standard numbers', () => {
  const c = JSON.parse(readFileSync('game.contract.json', 'utf8'));
  assert.equal(c.contract_version, '1.1');
  assert.deepEqual(c.tuning, T);
  assert.deepEqual(
    [c.tuning.player_speed, c.tuning.carry_capacity, c.tuning.lantern_cost, c.tuning.pickup_radius, c.tuning.interact_radius,
      c.tuning.pulse_cost, c.tuning.pulse_radius, c.tuning.pulse_cooldown_s, c.tuning.pulse_stun_s, c.tuning.shade_speed,
      c.tuning.dash_speed, c.tuning.dash_duration_s, c.tuning.dash_cooldown_s, c.tuning.night2_duration_s, c.tuning.night3_duration_s, c.tuning.fall_enabled],
    [6, 10, 10, 1, 2, 3, 5, 3, 2, 4, 14, 0.2, 1.5, 330, 360, true]);
  assert.deepEqual(c.tuning.score, { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 });
});

test('B/E: tick model + v1.1 snapshot fields', () => {
  const r = runHeadless({ scenario: quiet(), ticks: 30, every: 10 });
  assert.equal(r.code, 0);
  assert.deepEqual(r.lines[0], { type: 'event', tick: 0, name: 'night_start', data: { night: 1 } });
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 10, 20, 30]);
  const s0 = r.snaps[0];
  assert.deepEqual(Object.keys(s0), ['type', 'tick', 'sim_tick', 'night', 'state', 'time_left_s', 'score', 'wind', 'player', 'lanterns', 'shades', 'motes_active', 'motes', 'drifters', 'charms']);
  assert.deepEqual(s0.player, { pos: [0, 0, 0], vel: [0, 0, 0], grounded: true, flames: 3, carried: 0, invuln: 0, dash_cd_s: 0, pulse_cd_s: 0, charm_s: 0 });
  assert.deepEqual(s0.wind, { active: false, dir_deg: 0 });
  assert.equal(r.snaps[3].time_left_s, 299.5);
  assert.deepEqual(r.end, { type: 'end', ticks: 30, state: 'playing', score: 0 });
});

test('E: determinism on all 3 nights (random everything + inputs); seed matters', () => {
  const inputs = { frames: [{ tick: 0, move: [0.3, 1] }, ...press(200, 'dash'), { tick: 300, move: [-1, 0.2] }, ...press(400, 'pulse'), ...press(500, 'jump')] };
  for (const night of [1, 2, 3]) {
    const a = runHeadless({ seed: 42, night, ticks: 2500, inputs });
    const b = runHeadless({ seed: 42, night, ticks: 2500, inputs });
    assert.equal(a.code, 0);
    assert.equal(a.raw, b.raw, `night ${night}`);
    assert.notEqual(a.raw, runHeadless({ seed: 43, night, ticks: 2500, inputs }).raw);
  }
});

test('C: cam_yaw rotation, normalization, instant stop (<= 0.1 s)', () => {
  let r = runHeadless({ scenario: quiet(), ticks: 60, inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] } });
  close(r.snaps.at(-1).player.pos[0], 6);
  r = runHeadless({ scenario: quiet(), ticks: 60, inputs: { frames: [{ tick: 0, move: [1, 1] }] } });
  const [x, , z] = r.snaps.at(-1).player.pos;
  close(Math.hypot(x, z), 6);
  r = runHeadless({ scenario: quiet(), ticks: 16, every: 1, inputs: { frames: [{ tick: 0, move: [1, 0] }, { tick: 10, move: [0, 0] }] } });
  assert.deepEqual(r.at(10).player.vel, [6, 0, 0]);
  assert.deepEqual(r.at(11).player.vel, [0, 0, 0]);
});

test('jump: 7 m/s, g=20 (peak ~1.225 m), only when grounded', () => {
  const r = runHeadless({ scenario: quiet(), ticks: 90, every: 1, inputs: { frames: [...press(0, 'jump'), ...press(20, 'jump')] } });
  const ys = r.snaps.map((s) => s.player.pos[1]);
  close(Math.max(...ys), 1.225, 0.06);
  assert.equal(r.at(1).player.grounded, false);
  assert.equal(r.snaps.at(-1).player.grounded, true);
  assert.equal(r.snaps.at(-1).player.pos[1], 0);
  // second press mid-air ignored: only one airborne interval of ~42 ticks
  assert.ok(r.snaps.filter((s) => !s.player.grounded).length < 50);
});

test('dash: 14 m/s for 12 ticks in facing dir when idle, cooldown 90 ticks from start, keeps height in air', () => {
  let r = runHeadless({ scenario: quiet(), ticks: 100, every: 1, inputs: { frames: [...press(0, 'dash'), ...press(30, 'dash'), ...press(90, 'dash')] } });
  assert.deepEqual(ev(r, 'dash').map((e) => e.tick), [1, 91]);
  close(r.at(12).player.pos[2], 2.8); // facing +Z at start
  close(r.at(20).player.pos[2], 2.8);
  assert.equal(r.at(1).player.dash_cd_s, 1.5);
  r = runHeadless({ scenario: quiet(), ticks: 40, every: 1, inputs: { frames: [...press(0, 'jump'), { tick: 10, dash: true, move: [1, 0] }] } });
  const y = r.at(11).player.pos[1];
  for (let t = 11; t <= 22; t++) assert.equal(r.at(t).player.pos[1], y);
  close(r.at(22).player.pos[0], 2.8, 0.01);
});

test('pickup: XZ <= 1.0 inclusive and height <= 1.5; no score for pickup', () => {
  const r = runHeadless({ scenario: quiet({ motes: [[0, 0, 1], [0, 0, -1.05], [0.5, 2, 0]] }), ticks: 1, every: 1 });
  assert.deepEqual(ev(r, 'mote_picked'), [{ type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } }]);
  assert.equal(r.at(1).motes_active, 2);
  assert.equal(r.end.score, 0);
});

test('pickup: capacity 10', () => {
  const r = runHeadless({ scenario: quiet({ motes: Array.from({ length: 13 }, () => [0, 0, 0]) }), ticks: 2, every: 1 });
  assert.equal(r.at(2).player.carried, 10);
  assert.equal(r.at(2).motes_active, 3);
});

test('deposit: min(carried, missing), +10 per deposited mote, progress remembered, edge only', () => {
  const scenario = quiet({ player: { carried: 4 }, lanterns: [{ id: 'L1', pos: [0, 0, 2], deposited: 3 }] });
  const r = runHeadless({ scenario, ticks: 10, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(ev(r, 'deposit').map((e) => e.data), [{ lantern_id: 'L1', amount: 4, deposited: 7 }]);
  assert.equal(r.end.score, 40);
  const far = runHeadless({ scenario: quiet({ player: { carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 2.05] }] }), ticks: 2, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.equal(ev(far, 'deposit').length, 0);
});

test('deposit: nearest unlit lantern, tie -> smaller id; lit lanterns ignored', () => {
  const scenario = quiet({ player: { carried: 1 }, lanterns: [{ id: 'L3', pos: [1, 0, 0] }, { id: 'L2', pos: [-1, 0, 0] }, { id: 'L1', pos: [0, 0, 0.5], lit: true }] });
  const r = runHeadless({ scenario, ticks: 1, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.equal(ev(r, 'deposit')[0].data.lantern_id, 'L2');
});

test('win all_lit: +100, bonus floor(seconds)*2 + 50*flames; pre-lit lanterns score nothing', () => {
  const scenario = quiet({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }, ...OTHERS_LIT] });
  const r = runHeadless({ scenario, ticks: 100, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(ev(r, 'lantern_lit')[0].data, { lantern_id: 'L1' });
  assert.deepEqual(ev(r, 'game_over')[0], { type: 'event', tick: 1, name: 'game_over', data: { result: 'won', reason: 'all_lit' } });
  assert.equal(r.end.score, 100 + 100 + 299 * 2 + 3 * 50);
  assert.deepEqual([r.end.ticks, r.end.state], [1, 'won']);
});

test('win on the exact tick time runs out; dawn otherwise', () => {
  const scenario = quiet({ time_left_s: 1 / 60, player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }, ...OTHERS_LIT] });
  let r = runHeadless({ scenario, ticks: 5, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.equal(ev(r, 'game_over')[0].data.result, 'won');
  r = runHeadless({ scenario: quiet({ time_left_s: 1 }), ticks: 500 });
  assert.deepEqual(ev(r, 'game_over')[0], { type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
});

test('shade: detect 12 m / give up 18 m, chase speed 4 m/s', () => {
  let r = runHeadless({ scenario: quiet({ shades: [{ id: 'S1', pos: [13, 0, 0] }, { id: 'S2', pos: [-11, 0, 0] }, { id: 'S3', pos: [0, 0, 18.5], state: 'chase' }] }), ticks: 1, every: 1 });
  assert.deepEqual(r.at(1).shades.map((s) => s.state), ['wander', 'chase', 'wander']);
  r = runHeadless({ scenario: quiet({ shades: [{ id: 'S1', pos: [11, 0, 0] }] }), ticks: 60 });
  close(r.snaps.at(-1).shades[0].pos[0], 7);
  r = runHeadless({ night: 3, scenario: quiet({ player: { pos: [0, 0, -20] }, shades: [{ id: 'S1', pos: [11, 0, -20] }] }), ticks: 60 });
  close(r.snaps.at(-1).shades[0].pos[0], 6.5); // Night 3: 4.5 m/s
});

test('hit: -1 flame, floor(carried/2) dropped on ring 1.5-2.5 m (ttl 8 s), invuln 90, shade recoils', () => {
  const r = runHeadless({ scenario: quiet({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [1, 0, 0] }] }), ticks: 200, every: 1 });
  const hits = ev(r, 'player_hit');
  assert.deepEqual(hits[0], { type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: 2, dropped: 2 } });
  const s1 = r.at(1);
  assert.equal(s1.player.carried, 3);
  assert.equal(s1.player.invuln, 1.5);
  assert.equal(s1.shades[0].state, 'recoil');
  const dropped = s1.motes.filter((m) => m.kind === 'dropped');
  assert.equal(dropped.length, 2);
  for (const m of dropped) {
    const d = Math.hypot(m.pos[0], m.pos[2]);
    assert.ok(d >= 1.5 - 1e-3 && d <= 2.5 + 1e-3, `ring ${d}`);
    assert.equal(m.ttl_s, 8);
  }
  close(r.at(60).shades[0].pos[0], 0.933 + 59 * (2 / 60), 0.01); // recoil: 2 m / 60 ticks
  assert.ok(hits[1].tick >= 91, 'no hit during invulnerability');
});

test('dropped motes: pickable from next tick, vanish after 480 ticks', () => {
  const r = runHeadless({ scenario: quiet({ motes: [{ pos: [5, 0, 0], kind: 'dropped' }] }), ticks: 481, every: 1 });
  assert.equal(r.at(479).motes_active, 1);
  assert.equal(r.at(480).motes_active, 0);
});

test('pulse: cost 3, 3D radius 5 from feet+0.8, stun 120, push 4 m over 15 ticks, +5 each, cooldown 3 s', () => {
  const scenario = quiet({ player: { carried: 10 }, shades: [{ id: 'S1', pos: [4.9, 0.8, 0] }, { id: 'S2', pos: [0, 5, 3], state: 'stunned', state_ticks_left: 1000 }, { id: 'S3', pos: [-6, 0, 0], state: 'stunned', state_ticks_left: 500 }] });
  const frames = [...press(0, 'pulse'), ...press(60, 'pulse'), ...press(180, 'pulse')];
  const r = runHeadless({ scenario, ticks: 200, every: 1, inputs: { frames } });
  const pulses = ev(r, 'pulse');
  assert.deepEqual(pulses[0], { type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: ['S1'] } }); // S2: hypot(3, 5-0.8) = 5.16 > 5
  assert.equal(pulses.length, 2, 'second press inside cooldown ignored');
  assert.equal(pulses[1].tick, 181);
  assert.equal(r.at(1).player.carried, 7);
  assert.equal(r.at(1).player.pulse_cd_s, 3);
  close(r.at(15).shades[0].pos[0], 8.9);
  close(r.at(30).shades[0].pos[0], 8.9);
  assert.equal(r.at(120).shades[0].state, 'stunned');
  assert.notEqual(r.at(121).shades[0].state, 'stunned');
});

test('pulse: 3D distance counts height; not enough motes -> nothing', () => {
  let r = runHeadless({ scenario: quiet({ player: { carried: 3 }, shades: [{ id: 'S1', pos: [3, 5, 0] }] }), ticks: 1, inputs: { frames: press(0, 'pulse') } });
  assert.deepEqual(ev(r, 'pulse')[0].data, { stunned_ids: [] }); // hypot(3, 4.2) = 5.16 > 5
  r = runHeadless({ scenario: quiet({ player: { carried: 2 }, shades: [{ id: 'S1', pos: [2, 0, 0] }] }), ticks: 1, inputs: { frames: press(0, 'pulse') } });
  assert.equal(ev(r, 'pulse').length, 0);
});

test('safe zone: lit lantern blocks shades at 6 m; shade inside when lit is evicted within 30 ticks and harmless', () => {
  let r = runHeadless({ scenario: quiet({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ id: 'S1', pos: [11, 0, 0] }] }), ticks: 300, every: 1 });
  for (const s of r.snaps.slice(1)) assert.ok(Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2]) >= 6 - 1e-3);
  assert.equal(ev(r, 'player_hit').length, 0);
  const scenario = quiet({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1.5] }], shades: [{ id: 'S1', pos: [0.5, 0, 0] }] });
  r = runHeadless({ scenario, ticks: 40, every: 1, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.equal(ev(r, 'lantern_lit').length, 1);
  assert.equal(ev(r, 'player_hit').length, 0);
  const sh = r.at(30).shades[0];
  close(Math.hypot(sh.pos[0], sh.pos[2] - 1.5), 6, 0.01);
});

test('fall: once, ignores invuln, -1 flame, lose all motes, wait 60, respawn at start with invuln 90', () => {
  const scenario = quiet({ player: { pos: [39.5, 0, 0], carried: 3, invuln_ticks: 500 } });
  const r = runHeadless({ scenario, ticks: 200, every: 1, inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
  const hit = ev(r, 'player_hit');
  assert.equal(hit.length, 1);
  assert.deepEqual(hit[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 3 });
  const t = hit[0].tick;
  assert.ok(r.at(t).player.pos[1] < -10);
  assert.deepEqual(r.at(t + 60).player.pos, [0, 0, 0]);
  assert.equal(r.at(t + 60).player.invuln, 1.5);
  // last flame: lose immediately
  const r2 = runHeadless({ scenario: quiet({ player: { pos: [39.5, 0, 0], flames: 1 } }), ticks: 200, inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
  assert.deepEqual(ev(r2, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(r2.end.ticks, ev(r2, 'player_hit')[0].tick);
});

test('no_flames wins over all_lit on the same tick (core-level: not reachable via a scenario)', () => {
  // Through the CLI this can't be staged: a fall blocks interaction and a lit lantern evicts nearby shades.
  // So we check the end-of-tick rule order directly on the core.
  const sim = createSim({ night: 1, scenario: quiet({ player: { carried: 10, flames: 1 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }, ...OTHERS_LIT] }) });
  sim.player.flames = 0; // as if a hit happened earlier in this tick
  const evs = step(sim, { interact: true });
  assert.ok(evs.some((e) => e.name === 'lantern_lit'));
  assert.deepEqual(evs.at(-1).data, { result: 'lost', reason: 'no_flames' });
});

test('spawns: 20 motes on distinct points; +1 at tick 240; shades 2 at tick 300 (spawning, >= 15 m away) then every 8 s', () => {
  const r = runHeadless({ scenario: { random_drifters: false }, ticks: 800, every: 10 });
  const m0 = r.at(0).motes;
  assert.equal(m0.length, 20);
  assert.equal(new Set(m0.map((m) => m.pos.join())).size, 20);
  assert.ok(m0.every((m) => m.kind === 'random' && m.ttl_s === null));
  assert.equal(r.at(240).motes_active, 21);
  assert.deepEqual(ev(r, 'shade_spawned').map((e) => [e.tick, e.data.id]), [[300, 'S1'], [300, 'S2'], [780, 'S3']]);
  const s300 = r.at(300);
  assert.deepEqual(s300.shades.map((s) => s.state), ['spawning', 'spawning']);
  for (const s of s300.shades) assert.ok(Math.hypot(s.pos[0], s.pos[2]) >= 15 && Math.abs(Math.hypot(s.pos[0], s.pos[2]) - 37) < 1e-2);
});

test('scenario setup emits no events except night_start, no score', () => {
  const r = runHeadless({ scenario: quiet({ lanterns: [{ id: 'L1', lit: true, deposited: 10 }] }), ticks: 1 });
  assert.deepEqual(r.events.map((e) => e.name), ['night_start']);
  assert.equal(r.end.score, 0);
});

test('errors: malformed inputs/scenario/args => exit 2 with stderr', () => {
  for (const inputs of ['{not json', { frames: [{ tick: 5 }, { tick: 5 }] }, { frames: [{ tick: 0, move: [2, 0] }] }, { frames: [{ tick: 0, pause: 1 }] }, {}]) {
    const r = runHeadless({ inputs });
    assert.equal(r.code, 2, JSON.stringify(inputs));
    assert.match(r.stderr, /error/);
  }
  for (const scenario of [[], { lanterns: [{ id: 'L6' }] }, { motes: [[0, 0]] }, { player: { flames: -1 } }, { shades: [{ pos: [0, 0, 0], state: 'angry' }] }, { drifters: [{ pos: [0, 0] }] }, { charms: [{ id: 'C1', available: 'yes' }] }]) {
    assert.equal(runHeadless({ scenario }).code, 2, JSON.stringify(scenario));
  }
  assert.equal(runHeadless({ night: 2, scenario: { lanterns: [{ id: 'L6', lit: true }] } }).code, 0);
  assert.equal(runHeadless({ night: 4 }).code, 2);
  assert.notEqual(runHeadless({ extraArgs: ['--bogus'] }).code, 0);
});
