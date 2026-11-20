// Pure game logic (Test Contract v1.0). NO DOM, NO three.js, NO Math.random, NO Date.
// Deterministic given (seed, scenario, inputs).
import { TUNING, WORLD } from './tuning.js';

export const TICK_RATE = 60;
const EPS = 1e-9;

export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r3 = (v) => { const x = Math.round(v * 1000) / 1000; return x === 0 ? 0 : x; };
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const secToTicks = (s) => Math.round(s * TICK_RATE);

export function defaultLanterns(count = TUNING.lantern_count_night1) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const a = (k * 2 * Math.PI) / count;
    out.push({ id: `L${k + 1}`, pos: [r3(WORLD.lantern_ring_radius * Math.sin(a)), 0, r3(WORLD.lantern_ring_radius * Math.cos(a))], deposited: 0, lit: false });
  }
  return out;
}

function randomPointInDisc(rng, radius, minFromOrigin) {
  for (;;) {
    const a = rng() * 2 * Math.PI;
    const r = Math.sqrt(rng()) * radius;
    if (r >= minFromOrigin) return [r * Math.cos(a), 0, r * Math.sin(a)];
  }
}

function addMote(s, pos) { s.motes.push({ id: `M${s.nextMote++}`, pos: [...pos] }); }

function addShade(s, pos, id) {
  const sh = { id: id ?? `S${s.nextShade++}`, pos: [...pos], stun: 0, state: 'chase' };
  s.shades.push(sh);
  keepOutOfSafeZones(s, sh);
  return sh;
}

function spawnRandomShade(s) {
  const a = s.rng() * 2 * Math.PI;
  return addShade(s, [WORLD.shade_spawn_radius * Math.cos(a), 0, WORLD.shade_spawn_radius * Math.sin(a)]);
}

function keepOutOfSafeZones(s, sh) {
  for (const L of s.lanterns) {
    if (!L.lit) continue;
    const dx = sh.pos[0] - L.pos[0], dz = sh.pos[2] - L.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < s.T.safe_radius) {
      const [ux, uz] = d > EPS ? [dx / d, dz / d] : [1, 0];
      sh.pos[0] = L.pos[0] + ux * s.T.safe_radius;
      sh.pos[2] = L.pos[2] + uz * s.T.safe_radius;
    }
  }
}

/**
 * scenario: Test Contract section D (already validated by caller).
 */
export function createSim({ seed = 1, scenario = null, tuning = TUNING } = {}) {
  const T = tuning;
  const sc = scenario ?? {};
  const s = {
    T, rng: makeRng(seed), tick: 0, state: 'playing', result: null, score: 0,
    timeLeftTicks: secToTicks(sc.time_left_s ?? T.night1_duration_s),
    player: { pos: [0, 0, 0], vy: 0, flames: T.flames, carried: 0, invuln: 0, pulseCd: 0 },
    lanterns: defaultLanterns(T.lantern_count_night1),
    motes: [], shades: [], nextMote: 1, nextShade: 1,
    randomMotes: sc.random_motes ?? true, randomShades: sc.random_shades ?? true,
    moteTimer: 0, shadeTimer: 0,
    prev: { jump: false, interact: false, pulse: false },
  };

  const p = sc.player ?? {};
  if (p.pos) s.player.pos = [...p.pos];
  if (p.carried != null) s.player.carried = p.carried;
  if (p.flames != null) s.player.flames = p.flames;

  for (const l of sc.lanterns ?? []) {
    const L = s.lanterns.find((x) => x.id === l.id);
    if (l.pos) L.pos = [...l.pos];
    if (l.deposited != null) L.deposited = l.deposited;
    if (l.lit != null) L.lit = l.lit;
  }

  if (sc.motes) sc.motes.forEach((m) => addMote(s, Array.isArray(m) ? m : m.pos));
  else if (s.randomMotes) for (let i = 0; i < WORLD.motes_initial; i++) addMote(s, randomPointInDisc(s.rng, WORLD.mote_spawn_radius, 4));

  if (sc.shades) {
    const used = sc.shades.map((x) => /^S(\d+)$/.exec(x.id ?? '')).filter(Boolean).map((m) => +m[1]);
    s.nextShade = Math.max(0, ...used) + 1;
    sc.shades.forEach((x) => addShade(s, x.pos, x.id));
  } else if (s.randomShades) for (let i = 0; i < WORLD.shades_initial; i++) spawnRandomShade(s);

  return s;
}

/**
 * One fixed step (1/60 s). input = held state for this tick:
 * { move:[x,z], cam_yaw_deg, jump, interact, pulse }. Returns events of this step.
 */
export function step(s, input) {
  if (s.state !== 'playing') return [];
  const T = s.T, p = s.player, t = s.tick + 1, events = [];
  const emit = (name, data) => events.push({ type: 'event', tick: t, name, data });
  const edge = (k) => !!input[k] && !s.prev[k];
  const jumpE = edge('jump'), interactE = edge('interact'), pulseE = edge('pulse');
  s.prev = { jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse };

  // 1. timers
  if (p.invuln > 0) p.invuln--;
  if (p.pulseCd > 0) p.pulseCd--;
  for (const sh of s.shades) if (sh.stun > 0 && --sh.stun === 0) sh.state = 'chase';

  // 2. player movement (camera-relative, normalized if longer than 1)
  const [mx, mz] = input.move ?? [0, 0];
  const th = ((input.cam_yaw_deg ?? 0) * Math.PI) / 180;
  let wx = mx * Math.cos(th) + mz * Math.sin(th);
  let wz = -mx * Math.sin(th) + mz * Math.cos(th);
  const len = Math.hypot(wx, wz);
  if (len > 1) { wx /= len; wz /= len; }
  p.pos[0] += (wx * T.player_speed) / TICK_RATE;
  p.pos[2] += (wz * T.player_speed) / TICK_RATE;
  const fromCenter = Math.hypot(p.pos[0], p.pos[2]);
  if (fromCenter > WORLD.island_radius) {
    p.pos[0] *= WORLD.island_radius / fromCenter;
    p.pos[2] *= WORLD.island_radius / fromCenter;
  }
  if (jumpE && p.pos[1] <= 0) p.vy = WORLD.jump_speed;
  if (p.pos[1] > 0 || p.vy > 0) {
    p.vy -= WORLD.gravity / TICK_RATE;
    p.pos[1] += p.vy / TICK_RATE;
    if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
  }

  // 3. pick up motes
  for (let i = 0; i < s.motes.length && p.carried < T.carry_capacity; i++) {
    if (distXZ(p.pos, s.motes[i].pos) <= T.pickup_radius + EPS) {
      s.motes.splice(i--, 1);
      p.carried++;
      s.score += T.score.per_mote;
      emit('mote_picked', { carried: p.carried });
    }
  }

  // 4. interact: deposit into nearest unlit lantern in range
  if (interactE && p.carried > 0) {
    let best = null, bestD = Infinity;
    for (const L of s.lanterns) {
      const d = distXZ(p.pos, L.pos);
      if (!L.lit && d <= T.interact_radius + EPS && d < bestD) { best = L; bestD = d; }
    }
    if (best) {
      const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
      p.carried -= amount;
      best.deposited += amount;
      emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      if (best.deposited >= T.lantern_cost) {
        best.lit = true;
        s.score += T.score.per_lantern;
        emit('lantern_lit', { lantern_id: best.id });
      }
    }
  }

  // 5. pulse
  if (pulseE && p.pulseCd === 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCd = secToTicks(T.pulse_cooldown_s);
    const ids = [];
    for (const sh of s.shades) {
      const d = distXZ(p.pos, sh.pos);
      if (d > T.pulse_radius + EPS) continue;
      sh.stun = secToTicks(T.pulse_stun_s);
      sh.state = 'stunned';
      const [ux, uz] = d > EPS ? [(sh.pos[0] - p.pos[0]) / d, (sh.pos[2] - p.pos[2]) / d] : [1, 0];
      sh.pos[0] += ux * T.pulse_push_m;
      sh.pos[2] += uz * T.pulse_push_m;
      ids.push(sh.id);
      s.score += T.score.per_stun;
    }
    emit('pulse', { stunned_ids: ids });
  }

  // 6. shade spawning
  if (s.randomShades && ++s.shadeTimer >= secToTicks(WORLD.shade_spawn_every_s)) {
    s.shadeTimer = 0;
    if (s.shades.length < WORLD.shades_max) emit('shade_spawned', { id: spawnRandomShade(s).id });
  }

  // 7. shades chase (stunned shades don't move); lit lanterns repel
  const shadeStep = T.shade_speed / TICK_RATE;
  for (const sh of s.shades) {
    if (sh.stun === 0) {
      const d = distXZ(sh.pos, p.pos);
      if (d > EPS) {
        const k = Math.min(shadeStep, d) / d;
        sh.pos[0] += (p.pos[0] - sh.pos[0]) * k;
        sh.pos[2] += (p.pos[2] - sh.pos[2]) * k;
      }
    }
    keepOutOfSafeZones(s, sh);
  }

  // 8. shade hits player (at most one hit per tick, then invulnerable)
  if (p.invuln === 0) {
    const hitter = s.shades.find((sh) => sh.stun === 0 && distXZ(sh.pos, p.pos) <= T.shade_hit_radius + EPS);
    if (hitter) {
      p.flames = Math.max(0, p.flames - 1);
      const dropped = Math.floor(p.carried * T.hit_drop_ratio);
      p.carried -= dropped;
      p.invuln = secToTicks(T.invuln_s);
      emit('player_hit', { by: 'shade', flames: p.flames, dropped });
    }
  }

  // 9. mote respawn
  if (s.randomMotes && s.motes.length < WORLD.motes_min && ++s.moteTimer >= secToTicks(WORLD.motes_respawn_s)) {
    s.moteTimer = 0;
    addMote(s, randomPointInDisc(s.rng, WORLD.mote_spawn_radius, 2));
  }

  // 10. clock + end conditions
  s.timeLeftTicks = Math.max(0, s.timeLeftTicks - 1);
  s.tick = t;
  let over = null;
  if (s.lanterns.every((L) => L.lit)) over = { result: 'won', reason: 'all_lit' };
  else if (p.flames <= 0) over = { result: 'lost', reason: 'no_flames' };
  else if (s.timeLeftTicks <= 0) over = { result: 'lost', reason: 'dawn' };
  if (over) {
    if (over.result === 'won') {
      s.score += Math.floor(s.timeLeftTicks / TICK_RATE) * T.score.per_second_left + p.flames * T.score.per_flame_left;
    }
    s.state = over.result;
    s.result = over;
    emit('game_over', over);
  }
  return events;
}

export function snapshot(s) {
  return {
    type: 'snapshot', tick: s.tick, sim_tick: s.tick, state: s.state,
    time_left_s: r3(s.timeLeftTicks / TICK_RATE), score: s.score,
    player: { pos: s.player.pos.map(r3), flames: s.player.flames, carried: s.player.carried },
    lanterns: s.lanterns.map((L) => ({ id: L.id, pos: L.pos.map(r3), lit: L.lit, deposited: L.deposited })),
    shades: s.shades.map((sh) => ({ id: sh.id, pos: sh.pos.map(r3), state: sh.state })),
    motes_active: s.motes.length,
    motes: s.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3) })),
  };
}
