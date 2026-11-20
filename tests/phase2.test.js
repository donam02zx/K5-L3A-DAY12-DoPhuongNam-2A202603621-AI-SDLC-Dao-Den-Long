// Ticket-02 Part 2/3 features — at least one headless scenario per new feature.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, quiet, ev, close as closeA, press } from './helpers.js';

const close = (a, b, eps) => closeA(assert, a, b, eps);

test('maps: standard lantern positions/ids for nights 1-3', () => {
  const pos = (night) => runHeadless({ night, scenario: quiet(), ticks: 0 }).snaps[0].lanterns.map((l) => [l.id, ...l.pos]);
  assert.deepEqual(pos(1), [['L1', 0, 0, 25], ['L2', 23.8, 0, 7.7], ['L3', 14.7, 0, -20.2], ['L4', -14.7, 0, -20.2], ['L5', -23.8, 0, 7.7]]);
  assert.deepEqual(pos(2), [['L1', 0, 0, 20], ['L2', 17, 0, -10], ['L3', -17, 0, -10], ['L4', 70, 0, 20], ['L5', 87, 0, -10], ['L6', 53, 0, -10]]);
  assert.deepEqual(pos(3), [['L1', 0, 6, 6], ['L2', 18, 3, 10], ['L3', -18, 3, 10], ['L4', 35, 0, -10], ['L5', -35, 0, -10], ['L6', 20, 0, -35], ['L7', -20, 0, -35]]);
});

test('night 2: bamboo bridge connects the islands; stepping off it falls', () => {
  let r = runHeadless({ night: 2, scenario: quiet({ charms: [] }), ticks: 700, every: 10, inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
  assert.ok(r.snaps.every((s) => s.player.grounded));
  close(r.snaps.at(-1).player.pos[0], 70, 0.01);
  r = runHeadless({ night: 2, scenario: quiet({ player: { pos: [35, 0, 0] } }), ticks: 120, inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.deepEqual(ev(r, 'player_hit')[0].data.by, 'fall');
});

test('night 2: bounce pad launches (vy 14, 24 m/s towards other island), lands on island B in ~1.4 s', () => {
  const r = runHeadless({ night: 2, scenario: quiet({ player: { pos: [20, 0, 18] } }), ticks: 120, every: 1, inputs: { frames: [{ tick: 0, move: [-1, 0] }] } });
  close(r.at(1).player.vel[1], 14 - 20 / 60, 1e-3);
  close(Math.hypot(r.at(1).player.vel[0], r.at(1).player.vel[2]), 24); // move keys don't override launch
  const landed = r.snaps.find((s) => s.tick > 1 && s.player.grounded);
  assert.ok(landed.tick >= 80 && landed.tick <= 88, `landed at ${landed.tick}`);
  assert.ok(Math.hypot(landed.player.pos[0] - 70, landed.player.pos[2]) <= 28);
  assert.equal(ev(r, 'player_hit').length, 0);
});

test('night 3: tier walls block, ramps climb to Y=3, pad reaches tier 2 (Y=6)', () => {
  // wall: walking from r=30 towards the centre at x=0 stops at the tier-1 cliff (r=24)
  let r = runHeadless({ night: 3, scenario: quiet({ player: { pos: [0, 0, 30] } }), ticks: 120, inputs: { frames: [{ tick: 0, move: [0, -1] }] } });
  const p = r.snaps.at(-1).player;
  assert.ok(p.pos[2] > 24 && p.pos[2] < 24.2 && p.pos[1] === 0, JSON.stringify(p));
  // ramp at 30 deg: foot r=30 (Y=0) -> top r=24 (Y=3) -> tier 1
  const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
  r = runHeadless({ night: 3, scenario: quiet({ player: { pos: [30 * c, 0, 30 * s] } }), ticks: 120, every: 30, inputs: { frames: [{ tick: 0, move: [-c, -s] }] } });
  close(r.at(30).player.pos[1], 1.5, 0.02);
  assert.equal(r.at(120).player.pos[1], 3);
  assert.equal(r.at(120).player.grounded, true);
  // pad at (0,3,13): vy 12, 8 m/s towards -Z -> lands on tier 2
  r = runHeadless({ night: 3, scenario: quiet({ player: { pos: [0, 3, 13] } }), ticks: 90 });
  const q = r.snaps.at(-1).player;
  assert.equal(q.pos[1], 6);
  assert.ok(q.grounded && Math.hypot(q.pos[0], q.pos[2]) <= 8 && Math.hypot(q.pos[0], q.pos[2]) >= 2);
});

test('night 3: wind every 30 s for 5 s pushes 2 m/s; disabled with wind_enabled=false; not on night 1', () => {
  let r = runHeadless({ night: 3, scenario: { ...quiet(), wind_enabled: true, player: { pos: [0, 0, -20] } }, ticks: 2101, every: 1 });
  assert.equal(r.at(1799).wind.active, false);
  assert.equal(r.at(1800).wind.active, true);
  assert.equal(r.at(2099).wind.active, true);
  assert.equal(r.at(2100).wind.active, false);
  const a = r.at(1800).player.pos, b = r.at(2099).player.pos;
  close(Math.hypot(b[0] - a[0], b[2] - a[2]), 2 * 299 / 60, 0.05);
  r = runHeadless({ night: 3, scenario: quiet({ player: { pos: [0, 0, -20] } }), ticks: 1801 });
  assert.equal(r.snaps.at(-1).wind.active, false);
  r = runHeadless({ night: 1, scenario: { random_shades: false }, ticks: 1801, every: 1800 });
  assert.equal(r.snaps.at(-1).wind.active, false);
});

test('drifters: spawn at tick 1200 on nights 2/3 only (D1), state idle', () => {
  const sc = { random_shades: false, random_motes: false };
  let r = runHeadless({ night: 2, scenario: sc, ticks: 1200, every: 1200 });
  assert.deepEqual(r.at(1200).drifters.map((d) => [d.id, d.state, d.stolen]), [['D1', 'idle', 0]]);
  r = runHeadless({ night: 1, scenario: sc, ticks: 1200, every: 1200 });
  assert.deepEqual(r.at(1200).drifters, []);
});

test('drifters: chase when carrying >= 5 within 15 m, steal min(3), flee 240 ticks then removed; invuln does not protect', () => {
  const scenario = quiet({ player: { carried: 6, invuln_ticks: 300 }, drifters: [{ id: 'D1', pos: [10, 1, 0] }] });
  const r = runHeadless({ night: 2, scenario, ticks: 400, every: 1 });
  assert.equal(r.at(1).drifters[0].state, 'chase');
  const st = ev(r, 'drifter_steal')[0];
  assert.deepEqual(st.data, { drifter_id: 'D1', amount: 3, carried: 3 });
  assert.equal(r.at(st.tick).drifters[0].state, 'flee');
  assert.equal(r.at(st.tick).drifters[0].stolen, 3);
  assert.equal(r.at(st.tick + 239).drifters[0].state, 'flee');
  assert.equal(r.at(st.tick + 240).drifters[0].state, 'removed');
  assert.equal(ev(r, 'drifter_steal').length, 1);
  // carrying < 5 => stays idle
  const r2 = runHeadless({ night: 2, scenario: quiet({ player: { carried: 4 }, drifters: [{ id: 'D1', pos: [5, 1, 0] }] }), ticks: 1, every: 1 });
  assert.equal(r2.at(1).drifters[0].state, 'idle');
});

test('drifters: steal happens before a shade hit in the same tick', () => {
  const scenario = quiet({ player: { carried: 6 }, drifters: [{ id: 'D1', pos: [0.5, 1, 0], state: 'chase' }], shades: [{ id: 'S1', pos: [-0.5, 0, 0] }] });
  const r = runHeadless({ night: 2, scenario, ticks: 1 });
  assert.deepEqual(r.events.slice(1).map((e) => e.name), ['drifter_steal', 'player_hit']);
  assert.equal(ev(r, 'player_hit')[0].data.dropped, 1); // floor((6-3)/2)
});

test('drifters: pulse on chase -> flee without stealing; pulse on loaded flee -> drifter_drop, removed after 120', () => {
  let r = runHeadless({ night: 2, scenario: quiet({ player: { carried: 6 }, drifters: [{ id: 'D1', pos: [3, 1, 0], state: 'chase' }] }), ticks: 30, every: 1, inputs: { frames: press(0, 'pulse') } });
  assert.equal(r.at(1).drifters[0].state, 'flee');
  assert.equal(ev(r, 'drifter_steal').length, 0);
  r = runHeadless({ night: 2, scenario: quiet({ player: { carried: 3 }, drifters: [{ id: 'D1', pos: [3, 1, 0], state: 'flee', stolen: 3 }] }), ticks: 130, every: 1, inputs: { frames: press(0, 'pulse') } });
  assert.deepEqual(ev(r, 'drifter_drop')[0].data, { drifter_id: 'D1', amount: 3 });
  assert.equal(r.at(1).motes.filter((m) => m.kind === 'dropped').length, 3);
  assert.equal(r.at(1).drifters[0].stolen, 0);
  assert.equal(r.at(120).drifters[0].state, 'flee');
  assert.equal(r.at(121).drifters[0].state, 'removed');
});

test('charm: pick -> 600 ticks, 7.2 m/s, dash ignores cooldown (not while dashing), respawns after 2700', () => {
  let r = runHeadless({ night: 2, scenario: quiet({ player: { pos: [35, 0, 0] } }), ticks: 61, every: 1, inputs: { frames: [{ tick: 1, move: [1, 0] }] } });
  assert.deepEqual(ev(r, 'charm_picked')[0], { type: 'event', tick: 1, name: 'charm_picked', data: { charm_id: 'C1', charm_ticks: 600 } });
  assert.equal(r.at(1).player.charm_s, 10);
  assert.deepEqual(r.at(1).charms, [{ id: 'C1', available: false, respawn_s: 45 }]);
  close(r.at(61).player.pos[0], 35 + 7.2);
  // dash spam with charm: press at 0 (ok), 5 (ignored: dashing), 12 (ok: no cooldown)
  const frames = [...press(0, 'dash'), ...press(5, 'dash'), ...press(12, 'dash')];
  r = runHeadless({ night: 2, scenario: quiet({ player: { charm_ticks: 600 } }), ticks: 30, inputs: { frames } });
  assert.deepEqual(ev(r, 'dash').map((e) => e.tick), [1, 13]);
  r = runHeadless({ night: 2, scenario: quiet(), ticks: 30, inputs: { frames } });
  assert.deepEqual(ev(r, 'dash').map((e) => e.tick), [1]);
  r = runHeadless({ night: 2, scenario: quiet({ charms: [{ id: 'C1', available: false, respawn_ticks: 10 }] }), ticks: 10, every: 1 });
  assert.equal(r.at(9).charms[0].available, false);
  assert.equal(r.at(10).charms[0].available, true);
});

test('pause: tick advances, sim_tick/time/cooldowns/spawns frozen, state "paused", inputs ignored', () => {
  const frames = [{ tick: 0, move: [1, 0] }, ...press(10, 'pause'), ...press(30, 'pause')];
  const r = runHeadless({ scenario: quiet(), ticks: 60, every: 5, inputs: { frames } });
  assert.deepEqual(ev(r, 'paused').map((e) => e.tick), [11]);
  assert.deepEqual(ev(r, 'resumed').map((e) => e.tick), [31]);
  for (const t of [15, 20, 25, 30]) {
    assert.equal(r.at(t).state, 'paused');
    assert.equal(r.at(t).sim_tick, 10);
    assert.equal(r.at(t).time_left_s, r.at(10).time_left_s);
    assert.deepEqual(r.at(t).player.pos, r.at(10).player.pos);
  }
  assert.equal(r.at(35).state, 'playing');
  assert.equal(r.at(60).sim_tick, 40);
  assert.deepEqual(r.end, { type: 'end', ticks: 60, state: 'playing', score: 0 });
  // shade schedule follows sim_tick: with a 100-tick pause the first spawn moves from tick 300 to 400
  const r2 = runHeadless({ scenario: { random_drifters: false }, ticks: 410, inputs: { frames: [...press(0, 'pause'), ...press(100, 'pause')] } });
  assert.equal(ev(r2, 'shade_spawned')[0].tick, 400); // paused ticks 1..100 => sim_tick = tick - 100
});

test('performance: full night 3 (21600 ticks) headless in <= 30 s', () => {
  const r = runHeadless({ night: 3, seed: 7, ticks: 21600, every: 60, scenario: { player: { invuln_ticks: 30000 } } });
  assert.equal(r.code, 0);
  assert.ok(r.ms <= 30000, `${r.ms} ms`);
});
