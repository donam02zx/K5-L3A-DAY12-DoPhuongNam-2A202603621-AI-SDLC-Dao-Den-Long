// Ticket-03 "Đèn cạn dầu" (Contract v1.2): lantern fuel, drain, relight, dawn win, capacity, scoring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, quiet, ev, press } from './helpers.js';

const fuel = (r, t, id = 'L1') => r.at(t).lanterns.find((l) => l.id === id).fuel;
const far = (id) => ({ id, pos: [30 + Number(id[1]) * 3, 0, 30] }); // park lanterns away from the action

test('fuel: lit => 100, decays 1/s, goes out at 0 with lantern_out (deposited reset, ever_lit kept)', () => {
  const r = runHeadless({ scenario: quiet({ lanterns: [{ id: 'L1', lit: true, fuel: 2 }] }), ticks: 130, every: 1 });
  assert.equal(fuel(r, 0), 2);
  assert.equal(fuel(r, 60), 1);
  assert.deepEqual(ev(r, 'lantern_out'), [{ type: 'event', tick: 120, name: 'lantern_out', data: { lantern_id: 'L1' } }]);
  const L = r.at(120).lanterns[0];
  assert.deepEqual([L.lit, L.fuel, L.deposited, L.ever_lit], [false, 0, 0, true]);
  const r2 = runHeadless({ scenario: quiet({ lanterns: [{ id: 'L1', lit: true }] }), ticks: 0 });
  assert.equal(r2.snaps[0].lanterns[0].fuel, 100); // lit without fuel => 100
});

test('refuel: used = min(carried, ceil((100-fuel)/10)), +10 fuel each (cap 100), +5 per mote; full lantern not selectable', () => {
  const scenario = quiet({ player: { carried: 8 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true, fuel: 55 }] });
  const r = runHeadless({ scenario, ticks: 4, every: 1, inputs: { frames: [...press(0, 'interact'), ...press(2, 'interact')] } });
  // tick 1: fuel 55 - 1/60 -> need ceil(45.0167/10) = 5 motes -> fuel 100
  assert.deepEqual(ev(r, 'refuel')[0].data, { lantern_id: 'L1', amount: 5, fuel: 100 });
  assert.equal(r.at(1).player.carried, 3);
  assert.equal(r.end.score, (5 + 1) * 5); // two refuels
  // tick 3: fuel 99.97 -> needs 1 more mote (ceil(0.033/10) = 1)
  assert.deepEqual(ev(r, 'refuel')[1].data, { lantern_id: 'L1', amount: 1, fuel: 100 });
});

test('relight: ever_lit lantern needs only 5 motes, +40, relight:true, relit_count++; first light +100 relight:false', () => {
  let r = runHeadless({ scenario: quiet({ player: { carried: 7 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], ever_lit: true }] }), ticks: 1, every: 1, inputs: { frames: press(0, 'interact') } });
  assert.deepEqual(ev(r, 'deposit')[0].data, { lantern_id: 'L1', amount: 5, deposited: 5 });
  assert.deepEqual(ev(r, 'lantern_lit')[0].data, { lantern_id: 'L1', relight: true });
  assert.equal(r.end.score, 5 * 5 + 40);
  const L = r.snaps.at(-1).lanterns[0];
  assert.deepEqual([L.lit, L.fuel, L.relit_count], [true, 100, 1]);
  r = runHeadless({ scenario: quiet({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }] }), ticks: 1, inputs: { frames: press(0, 'interact') } });
  assert.deepEqual(ev(r, 'lantern_lit')[0].data, { lantern_id: 'L1', relight: false });
  assert.equal(r.end.score, 10 * 5 + 100);
});

test('capacity: 10 + 2 x successful_lights, max 20; shown in snapshot; scenario sets successful_lights', () => {
  let r = runHeadless({ scenario: quiet({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }] }), ticks: 1, every: 1, inputs: { frames: press(0, 'interact') } });
  assert.equal(r.at(1).player.capacity, 12);
  r = runHeadless({ scenario: quiet({ player: { successful_lights: 9 }, motes: Array.from({ length: 25 }, () => [0, 0, 0]) }), ticks: 1, every: 1 });
  assert.equal(r.at(0).player.capacity, 20);
  assert.equal(r.at(1).player.carried, 20);
});

test('safe zone: fuel < 30 loses it, exactly 30 keeps it', () => {
  const mk = (f) => quiet({ player: { pos: [0, 0, -30] }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: f }], shades: [{ id: 'S1', pos: [0, 0, 7], state: 'wander' }] });
  // fuel 31 -> stays >= 30 for the first 60 ticks: shade blocked at 6 m
  let r = runHeadless({ scenario: mk(31), ticks: 50, every: 50 });
  assert.ok(Math.hypot(...[0, 2].map((i) => r.at(50).shades[0].pos[i])) >= 6 - 1e-3);
  // fuel 29 -> no zone: the wandering shade goes in to drain it
  r = runHeadless({ scenario: mk(29), ticks: 260, every: 10 });
  assert.equal(r.at(260).shades[0].state, 'drain');
});

test('drain: wander shade goes to nearest weak lantern, drains 5/s (stacking), fuel_drain every 60 ticks', () => {
  const scenario = quiet({ player: { pos: [0, 0, -30] }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 25 }, { ...far('L2'), lit: true, fuel: 20 }],
    shades: [{ id: 'S1', pos: [1.5, 0, 0], state: 'wander' }, { id: 'S2', pos: [-1.5, 0, 0], state: 'wander' }] });
  const r = runHeadless({ scenario, ticks: 61, every: 1 });
  assert.deepEqual(r.at(1).shades.map((s) => s.state), ['drain', 'drain']);
  // ticks 2..61 = 60 ticks drained by 2 shades (10/s) + decay (1/s): 25 - 61/60 - 10 = 13.98
  assert.equal(fuel(r, 61), 14);
  const d = ev(r, 'fuel_drain');
  assert.deepEqual(d.map((e) => [e.tick, e.data.shade_id, e.data.lantern_id]), [[61, 'S1', 'L1'], [61, 'S2', 'L1']]);
});

test('drain exits: player within 6 m -> chase; lantern out -> wander; refuel >= 30 -> wander + evicted harmlessly', () => {
  const base = { lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [1.5, 0, 0], state: 'drain', target_lantern_id: 'L1' }] };
  let r = runHeadless({ scenario: quiet({ ...base, player: { pos: [6, 0, 0] } }), ticks: 1, every: 1 });
  assert.equal(r.at(1).shades[0].state, 'chase');
  r = runHeadless({ scenario: quiet({ ...base, player: { pos: [0, 0, -30] }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 0.05 }] }), ticks: 2, every: 1 });
  assert.equal(ev(r, 'lantern_out')[0].tick, 1);
  assert.equal(r.at(1).shades[0].state, 'wander');
  // refuel from 20 to >= 30 while the shade is 1.5 m away and the player 2 m away: shade evicted, no hit
  r = runHeadless({ scenario: quiet({ ...base, player: { pos: [-1.9, 0, 0], carried: 2 } }), ticks: 30, every: 1, inputs: { frames: press(0, 'interact') } });
  assert.ok(ev(r, 'refuel')[0].data.fuel >= 30);
  assert.equal(ev(r, 'player_hit').length, 0);
  const sh = r.at(30).shades[0];
  assert.ok(Math.abs(Math.hypot(sh.pos[0], sh.pos[2]) - 6) < 0.01);
});

test('pulse on a draining shade: +15 (else +5), it becomes stunned then wander', () => {
  const scenario = quiet({ player: { pos: [0, 0, -3], carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }],
    shades: [{ id: 'S1', pos: [0, 0, 1.5], state: 'drain', target_lantern_id: 'L1' }, { id: 'S2', pos: [3, 0, -3], state: 'stunned', state_ticks_left: 500 }] });
  const r = runHeadless({ scenario, ticks: 1, every: 1, inputs: { frames: press(0, 'pulse') } });
  assert.deepEqual(ev(r, 'pulse')[0].data.stunned_ids, ['S1', 'S2']);
  assert.equal(r.end.score, 15 + 5);
  assert.equal(r.at(1).shades[0].state, 'stunned');
});

test('no early win: all lanterns lit does not end the night', () => {
  const scenario = quiet({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }, ...['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }))] });
  const r = runHeadless({ scenario, ticks: 120, inputs: { frames: press(0, 'interact') } });
  assert.equal(ev(r, 'lantern_lit').length, 1);
  assert.equal(ev(r, 'game_over').length, 0);
  assert.equal(r.end.state, 'playing');
});

test('dawn win needs ceil(0.6 x n) lit: night 1 3/5, night 2 4/6, night 3 5/7; dawn bonus 50 + floor(fuel) per lit + 50 per flame', () => {
  const ids = (n) => Array.from({ length: n }, (_, i) => `L${i + 1}`);
  for (const [night, need, total] of [[1, 3, 5], [2, 4, 6], [3, 5, 7]]) {
    const player = night === 3 ? { pos: [0, 0, -20] } : {};
    const ok = runHeadless({ night, scenario: quiet({ player, time_left_s: 1 / 60, lanterns: ids(need).map((id) => ({ id, lit: true, fuel: 40.5 })) }), ticks: 2 });
    assert.deepEqual(ev(ok, 'game_over')[0].data, { result: 'won', reason: 'dawn_survived' }, `night ${night}`);
    // fuel 40.5 - 1/60 = 40.48 -> floor 40 ; per lantern 50 + 40
    assert.equal(ok.end.score, need * 90 + 3 * 50);
    const no = runHeadless({ night, scenario: quiet({ player, time_left_s: 1 / 60, lanterns: ids(need - 1).map((id) => ({ id, lit: true })) }), ticks: 2 });
    assert.deepEqual(ev(no, 'game_over')[0].data, { result: 'lost', reason: 'dawn' });
    assert.equal(no.end.score, 0);
    void total;
  }
});

test('nights last 240 / 270 / 300 s', () => {
  for (const [night, s] of [[1, 240], [2, 270], [3, 300]]) assert.equal(runHeadless({ night, scenario: quiet(), ticks: 0 }).snaps[0].time_left_s, s);
});

test('scenario v1.2 validation: fuel range, ever_lit, target_lantern_id, drain state', () => {
  assert.equal(runHeadless({ scenario: { lanterns: [{ id: 'L1', lit: true, fuel: 120 }] } }).code, 2);
  assert.equal(runHeadless({ scenario: { lanterns: [{ id: 'L1', ever_lit: 'yes' }] } }).code, 2);
  assert.equal(runHeadless({ scenario: { shades: [{ pos: [0, 0, 5], target_lantern_id: 'L9' }] } }).code, 2);
  assert.equal(runHeadless({ scenario: { shades: [{ pos: [0, 0, 5], state: 'drain', target_lantern_id: 'L1' }] } }).code, 0);
});
