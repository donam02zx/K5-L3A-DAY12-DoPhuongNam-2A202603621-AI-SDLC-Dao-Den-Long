// Test Contract v1.0 — black-box tests through the headless CLI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TUNING as T } from '../src/core/tuning.js';
import { runHeadless, quiet, ev } from './helpers.js';

const close = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const lit = (ids) => ids.map((id) => ({ id, lit: true }));
const OTHERS_LIT = lit(['L2', 'L3', 'L4', 'L5']);

test('A: game.contract.json tuning matches the numbers the game uses', () => {
  const c = JSON.parse(readFileSync('game.contract.json', 'utf8'));
  assert.equal(c.contract_version, '1.0');
  assert.deepEqual(c.tuning, T);
  assert.equal(c.tuning.lantern_count_night1, 5);
  for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd']) assert.ok(c[k], k);
});

test('B/E: tick model — snapshot at 0, every N, end line, time_left_s', () => {
  const r = runHeadless({ scenario: quiet(), ticks: 30, every: 10 });
  assert.equal(r.code, 0);
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 10, 20, 30]);
  assert.deepEqual(r.snaps[0].player, { pos: [0, 0, 0], flames: T.flames, carried: 0 });
  assert.equal(r.snaps[0].time_left_s, T.night1_duration_s);
  assert.equal(r.snaps[3].time_left_s, T.night1_duration_s - 0.5);
  assert.equal(r.snaps[3].sim_tick, 30);
  assert.equal(r.snaps[0].lanterns.length, 5);
  assert.deepEqual(r.end, { type: 'end', ticks: 30, state: 'playing', score: 0 });
});

test('B: default snapshot-every is 10', () => {
  const r = runHeadless({ scenario: quiet(), ticks: 20, extraArgs: [] , every: 10 });
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 10, 20]);
});

test('E: determinism — same seed/inputs => identical output, incl. generated ids', () => {
  const inputs = { frames: [{ tick: 0, move: [0.3, 1] }, { tick: 300, move: [-1, 0], pulse: true }, { tick: 301, pulse: false }] };
  const a = runHeadless({ seed: 42, ticks: 2400, inputs });
  const b = runHeadless({ seed: 42, ticks: 2400, inputs });
  assert.equal(a.code, 0);
  assert.equal(a.raw, b.raw);
  assert.ok(ev(a, 'shade_spawned').length >= 1 || a.end.state !== 'playing');
  const c = runHeadless({ seed: 43, ticks: 2400, inputs });
  assert.notEqual(a.raw, c.raw);
});

test('C: move with cam_yaw_deg rotation and normalization', () => {
  // yaw 90: move [0,1] -> x' = sin90 = +1 -> moves +X
  let r = runHeadless({ scenario: quiet(), ticks: 60, inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] } });
  close(r.end && r.snaps.at(-1).player.pos[0], T.player_speed);
  close(r.snaps.at(-1).player.pos[2], 0);
  // diagonal is normalized to length 1
  r = runHeadless({ scenario: quiet(), ticks: 60, inputs: { frames: [{ tick: 0, move: [1, 1] }] } });
  const [x, , z] = r.snaps.at(-1).player.pos;
  close(Math.hypot(x, z), T.player_speed);
});

test('C: frames keep absent fields; frame at tick k applies to step k', () => {
  const r = runHeadless({ scenario: quiet(), ticks: 20, every: 1, inputs: { frames: [{ tick: 0, move: [1, 0] }, { tick: 10, cam_yaw_deg: 0 }] } });
  // still moving after tick 10 (move kept)
  close(r.snaps[20].player.pos[0], (T.player_speed / 60) * 20);
  close(r.snaps[1].player.pos[0], T.player_speed / 60);
});

test('jump: rises above ground then lands on Y = 0', () => {
  const r = runHeadless({ scenario: quiet(), ticks: 120, every: 5, inputs: { frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }] } });
  assert.ok(Math.max(...r.snaps.map((s) => s.player.pos[1])) > 0.5);
  assert.equal(r.snaps.at(-1).player.pos[1], 0);
});

test('pickup: inclusive radius, emits mote_picked, adds per_mote score', () => {
  const r = runHeadless({ scenario: quiet({ motes: [[0, 0, T.pickup_radius], [0, 0, -(T.pickup_radius + 0.05)]] }), ticks: 1, every: 1 });
  assert.deepEqual(ev(r, 'mote_picked'), [{ type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } }]);
  assert.equal(r.snaps.at(-1).motes_active, 1);
  assert.equal(r.end.score, T.score.per_mote);
});

test('pickup: stops at carry_capacity', () => {
  const motes = Array.from({ length: T.carry_capacity + 3 }, () => [0, 0, 0]);
  const r = runHeadless({ scenario: quiet({ motes }), ticks: 5, every: 1 });
  assert.equal(r.snaps.at(-1).player.carried, T.carry_capacity);
  assert.equal(r.snaps.at(-1).motes_active, 3);
});

test('deposit + lantern_lit + win all_lit with end-of-night bonus', () => {
  const scenario = quiet({ player: { carried: T.lantern_cost }, lanterns: [{ id: 'L1', pos: [0, 0, T.interact_radius] }, ...OTHERS_LIT] });
  const r = runHeadless({ scenario, ticks: 100, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(ev(r, 'deposit')[0].data, { lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost });
  assert.deepEqual(ev(r, 'lantern_lit')[0], { type: 'event', tick: 1, name: 'lantern_lit', data: { lantern_id: 'L1' } });
  assert.deepEqual(ev(r, 'game_over')[0].data, { result: 'won', reason: 'all_lit' });
  const secs = Math.floor(T.night1_duration_s - 1 / 60);
  // pre-lit lanterns from the scenario give no points
  assert.equal(r.end.score, T.score.per_lantern + secs * T.score.per_second_left + T.flames * T.score.per_flame_left);
  assert.deepEqual([r.end.ticks, r.end.state], [1, 'won']);
});

test('deposit: partial, only on false->true edge, not out of range', () => {
  const scenario = quiet({ player: { carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], deposited: 1 }] });
  const r = runHeadless({ scenario, ticks: 10, inputs: { frames: [{ tick: 0, interact: true }] } }); // held 10 ticks
  assert.equal(ev(r, 'deposit').length, 1);
  assert.deepEqual(ev(r, 'deposit')[0].data, { lantern_id: 'L1', amount: 2, deposited: 3 });
  assert.equal(ev(r, 'lantern_lit').length, 0);
  const far = runHeadless({ scenario: quiet({ player: { carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, T.interact_radius + 0.1] }] }), ticks: 2, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.equal(ev(far, 'deposit').length, 0);
});

test('pulse: stuns + pushes shades in radius, costs light, scores per_stun, respects cooldown', () => {
  const scenario = quiet({ player: { carried: 3 }, shades: [{ id: 'S1', pos: [T.pulse_radius, 0, 0] }, { id: 'S2', pos: [0, 0, -(T.pulse_radius + 0.5)] }] });
  const frames = [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 5, pulse: true }, { tick: 6, pulse: false }];
  const r = runHeadless({ scenario, ticks: 1, every: 1, inputs: { frames } });
  assert.deepEqual(ev(r, 'pulse')[0], { type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: ['S1'] } });
  const s1 = r.snaps.at(-1).shades.find((s) => s.id === 'S1');
  assert.equal(s1.state, 'stunned');
  close(s1.pos[0], T.pulse_radius + T.pulse_push_m);
  assert.equal(r.snaps.at(-1).player.carried, 3 - T.pulse_cost);
  assert.equal(r.end.score, T.score.per_stun);
  const r2 = runHeadless({ scenario, ticks: 10, inputs: { frames } }); // second press within cooldown
  assert.equal(ev(r2, 'pulse').length, 1);
});

test('pulse: not enough light => no pulse', () => {
  const r = runHeadless({ scenario: quiet({ player: { carried: T.pulse_cost - 1 }, shades: [{ id: 'S1', pos: [2, 0, 0] }] }), ticks: 1, inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.equal(ev(r, 'pulse').length, 0);
});

test('stun: stunned shade stays still for pulse_stun_s then chases again', () => {
  const stunTicks = T.pulse_stun_s * 60;
  const r = runHeadless({ scenario: quiet({ player: { carried: 1 }, shades: [{ id: 'S1', pos: [3, 0, 0] }] }), ticks: stunTicks + 1, every: 1, inputs: { frames: [{ tick: 0, pulse: true }] } });
  const x = (t) => r.snaps[t].shades[0].pos[0];
  assert.equal(x(1), x(stunTicks));
  assert.equal(r.snaps[stunTicks].shades[0].state, 'stunned');
  assert.equal(r.snaps[stunTicks + 1].shades[0].state, 'chase');
  assert.ok(x(stunTicks + 1) < x(stunTicks));
});

test('shade chases at shade_speed', () => {
  const r = runHeadless({ scenario: quiet({ shades: [{ id: 'S1', pos: [20, 0, 0] }] }), ticks: 60 });
  close(r.snaps.at(-1).shades[0].pos[0], 20 - T.shade_speed);
});

test('hit: loses a flame, drops hit_drop_ratio of carried, invulnerable for invuln_s', () => {
  const inv = T.invuln_s * 60;
  const r = runHeadless({ scenario: quiet({ player: { carried: 4 }, shades: [{ id: 'S1', pos: [T.shade_hit_radius, 0, 0] }] }), ticks: inv + 1 });
  const hits = ev(r, 'player_hit');
  assert.equal(hits.length, 2);
  assert.deepEqual(hits[0], { type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: T.flames - 1, dropped: Math.floor(4 * T.hit_drop_ratio) } });
  assert.equal(hits[1].tick, 1 + inv);
});

test('lose: no_flames ends the run early with exit code 0', () => {
  const r = runHeadless({ scenario: quiet({ player: { flames: 1 }, shades: [{ id: 'S1', pos: [0.5, 0, 0] }] }), ticks: 500 });
  assert.equal(r.code, 0);
  assert.deepEqual(ev(r, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'lost', score: 0 });
});

test('lose: dawn when time runs out', () => {
  const r = runHeadless({ scenario: quiet({ time_left_s: 1 }), ticks: 500 });
  assert.deepEqual(ev(r, 'game_over')[0], { type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
  assert.equal(r.end.ticks, 60);
});

test('safe_radius: shades never enter a lit lantern radius', () => {
  const scenario = quiet({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ id: 'S1', pos: [15, 0, 0] }, { id: 'S2', pos: [0, 0, 2] }] });
  const r = runHeadless({ scenario, ticks: 600, every: 1 });
  for (const s of r.snaps.slice(1)) for (const sh of s.shades) assert.ok(Math.hypot(sh.pos[0], sh.pos[2]) >= T.safe_radius - 1e-3);
  assert.equal(ev(r, 'player_hit').length, 0);
});

test('fall disabled: player cannot leave the island', () => {
  const r = runHeadless({ scenario: quiet(), ticks: 1200, inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
  assert.ok(r.snaps.at(-1).player.pos[0] <= 40.001);
  assert.equal(ev(r, 'player_hit').length, 0);
});

test('D: scenario setup emits no events and no score (pre-lit lanterns)', () => {
  const r = runHeadless({ scenario: quiet({ lanterns: [{ id: 'L1', lit: true, deposited: 5 }] }), ticks: 1 });
  assert.equal(r.events.length, 0);
  assert.equal(r.snaps[0].score, 0);
  assert.equal(r.snaps[0].lanterns[0].lit, true);
});

test('D: random_shades default spawns shades with sequential ids over time', () => {
  // player stands inside a lit lantern's safe zone so the default shades cannot end the run early
  const r = runHeadless({ scenario: { random_motes: false, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }] }, ticks: 1800 });
  assert.deepEqual(ev(r, 'shade_spawned').map((e) => e.data.id), ['S3']);
});

test('errors: malformed inputs/scenario => exit 2 with stderr', () => {
  for (const inputs of ['{not json', { frames: [{ tick: 5 }, { tick: 5 }] }, { frames: [{ tick: 0, move: [2, 0] }] }, { frames: [{ tick: 0, pulse: 1 }] }, {}]) {
    const r = runHeadless({ inputs });
    assert.equal(r.code, 2, JSON.stringify(inputs));
    assert.match(r.stderr, /error/);
  }
  for (const scenario of [[], { lanterns: [{ id: 'L9' }] }, { motes: [[0, 0]] }, { player: { flames: -1 } }]) {
    assert.equal(runHeadless({ scenario }).code, 2, JSON.stringify(scenario));
  }
  assert.notEqual(runHeadless({ extraArgs: ['--bogus'] }).code, 0);
});
