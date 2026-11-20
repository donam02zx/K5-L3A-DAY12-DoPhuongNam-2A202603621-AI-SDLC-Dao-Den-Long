// Pure game logic — Test Contract v1.2 / Ticket-02 + Ticket-03 (lantern fuel, dawn win). NO DOM, NO three.js, NO Math.random, NO Date.
// Deterministic given (seed, night, scenario, inputs). Tick order follows Ticket-02 exactly.
import { TUNING, SPEC as S } from './tuning.js';
import { NIGHTS } from './maps.js';

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

const r1 = (v) => { const x = Math.round(v * 10) / 10; return x === 0 ? 0 : x; };
const r3 = (v) => { const x = Math.round(v * 1000) / 1000; return x === 0 ? 0 : x; };
const dXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const idNum = (id) => parseInt(String(id).replace(/\D/g, ''), 10) || 0;
const byId = (a, b) => idNum(a.id) - idNum(b.id);
const secToTicks = (s) => Math.round(s * TICK_RATE);
const unitXZ = (from, to) => {
  const dx = to[0] - from[0], dz = to[2] - from[2], d = Math.hypot(dx, dz);
  return d > EPS ? [dx / d, dz / d, d] : [1, 0, 0];
};

export const nightDuration = (T, n) => T[`night${n}_duration_s`];
const SHADE_DEFAULT_TICKS = { spawning: S.spawning_ticks, recoil: S.recoil_ticks, stunned: S.stun_ticks, wander: 0, chase: 0, drain: 0 };
// Fuel is stored as an integer in 1/60 units (1 fuel/s decay = 1 unit per tick) to avoid float drift.
const FU = 60;
const fuelMax = (T) => T.fuel_max * FU;
const lowFuel = (T) => T.low_fuel_threshold * FU;
export const capacity = (s) => Math.min(s.T.capacity_max, s.T.carry_capacity + S.capacity_per_light * s.player.successfulLights);
export const winNeed = (s) => Math.ceil(s.T.win_ratio * s.lanterns.length - 1e-9);
const protects = (s, L) => L.lit && L.fuel >= lowFuel(s.T); // lit and fuel >= 30 keeps the safe zone

export function createSim({ seed = 1, night = 1, scenario = null, tuning = TUNING } = {}) {
  const T = tuning, map = NIGHTS[night], sc = scenario ?? {};
  const s = {
    T, map, night, rng: makeRng(seed), tick: 0, simTick: 0, paused: false, state: 'playing', result: null, score: 0,
    timeLeftTicks: secToTicks(sc.time_left_s ?? nightDuration(T, night)),
    player: {
      pos: [...map.start], vel: [0, 0, 0], grounded: true, facing: [0, 1], flames: T.flames, carried: 0,
      invuln: 0, dashCd: 0, pulseCd: 0, charm: 0, successfulLights: 0, dashLeft: 0, dashDir: [0, 1], launch: null, fallWait: 0,
    },
    lanterns: map.lanterns.map((L) => ({ id: L.id, pos: [...L.pos], deposited: 0, lit: false, fuel: 0, everLit: false, relitCount: 0 })),
    motes: [], shades: [], drifters: [],
    charms: map.charms.map((c) => ({ id: c.id, pos: [...c.pos], available: true, respawn: 0 })),
    nextMote: 1, nextShade: 1, nextDrifter: 1,
    randomMotes: sc.random_motes ?? true, randomShades: sc.random_shades ?? true,
    randomDrifters: (sc.random_drifters ?? true) && map.drifters,
    windEnabled: (sc.wind_enabled ?? true) && map.wind,
    wind: { active: false, dirDeg: 0, left: 0 },
    prev: { jump: false, interact: false, pulse: false, dash: false, pause: false },
  };
  const p = s.player, sp = sc.player ?? {};
  if (sp.pos) p.pos = [...sp.pos];
  if (sp.carried != null) p.carried = sp.carried;
  if (sp.flames != null) p.flames = sp.flames;
  if (sp.invuln_ticks != null) p.invuln = sp.invuln_ticks;
  if (sp.dash_cd_ticks != null) p.dashCd = sp.dash_cd_ticks;
  if (sp.pulse_cd_ticks != null) p.pulseCd = sp.pulse_cd_ticks;
  if (sp.charm_ticks != null) p.charm = sp.charm_ticks;
  if (sp.successful_lights != null) p.successfulLights = sp.successful_lights;
  const g0 = map.ground(p.pos[0], p.pos[2]);
  p.grounded = g0 !== null && Math.abs(p.pos[1] - g0) <= S.step_up;
  if (p.grounded) p.pos[1] = g0;

  for (const l of sc.lanterns ?? []) {
    const L = s.lanterns.find((x) => x.id === l.id);
    if (l.pos) L.pos = [...l.pos];
    if (l.deposited != null) L.deposited = l.deposited;
    if (l.lit != null) L.lit = l.lit;
    if (l.ever_lit != null) L.everLit = l.ever_lit; else if (L.lit) L.everLit = true;
    L.fuel = L.lit ? Math.round((l.fuel ?? T.fuel_max) * FU) : 0;
  }

  if (sc.motes) sc.motes.forEach((m) => addMote(s, Array.isArray(m) ? m : m.pos, m.kind === 'dropped' ? 'dropped' : 'random', m.ttl_ticks));
  else if (s.randomMotes) {
    const pts = map.moteSpawns.map((_, i) => i);
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(s.rng() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    pts.slice(0, S.motes_initial).sort((a, b) => a - b).forEach((i) => addMote(s, map.moteSpawns[i], 'random'));
  }

  if (sc.shades) {
    s.nextShade = Math.max(0, ...sc.shades.map((x) => idNum(x.id ?? ''))) + 1;
    for (const x of sc.shades) {
      const state = x.state ?? 'wander';
      const sh = newShade(x.id ?? `S${s.nextShade++}`, x.pos, state, x.state_ticks_left ?? SHADE_DEFAULT_TICKS[state]);
      if (x.target_lantern_id) sh.lantern = s.lanterns.find((L) => L.id === x.target_lantern_id) ?? null;
      s.shades.push(sh);
    }
    s.shades.sort(byId);
  }
  if (sc.drifters) {
    s.nextDrifter = Math.max(0, ...sc.drifters.map((x) => idNum(x.id ?? ''))) + 1;
    for (const x of sc.drifters) {
      const state = x.state ?? 'idle';
      s.drifters.push({ id: x.id ?? `D${s.nextDrifter++}`, pos: [...x.pos], state, stolen: x.stolen ?? 0, left: state === 'flee' ? S.drifter_flee_ticks : 0, target: null });
    }
  }
  if (sc.charms) {
    s.charms = sc.charms.map((c) => {
      const def = map.charms.find((d) => d.id === c.id);
      const respawn = c.respawn_ticks ?? 0;
      return { id: c.id, pos: [...(c.pos ?? def?.pos ?? [0, 0, 0])], available: c.available ?? respawn === 0, respawn };
    });
  }
  return s;
}

function newShade(id, pos, state, ticks) {
  return { id, pos: [...pos], state, ticks, pushLeft: 0, pushDir: [1, 0], evict: 0, evictFrom: null, target: null, lantern: null, drainTicks: 0 };
}

function addMote(s, pos, kind, ttl) {
  s.motes.push({ id: `M${s.nextMote++}`, pos: [...pos], kind, ttl: kind === 'dropped' ? (ttl ?? S.dropped_ttl) : null });
}

function dropMotes(s, center, n) {
  for (let i = 0; i < n; i++) {
    const a = s.rng() * 2 * Math.PI, r = S.drop_ring[0] + s.rng() * (S.drop_ring[1] - S.drop_ring[0]);
    const x = center[0] + r * Math.cos(a), z = center[2] + r * Math.sin(a);
    addMote(s, [x, s.map.ground(x, z) ?? center[1], z], 'dropped');
  }
}

function inSafeZone(s, pos) {
  return s.lanterns.some((L) => protects(s, L) && dXZ(pos, L.pos) < s.T.safe_radius - EPS);
}

function blockBySafeZones(s, sh) {
  for (const L of s.lanterns) {
    if (!protects(s, L) || L === sh.evictFrom) continue;
    const [ux, uz, d] = unitXZ(L.pos, sh.pos);
    if (d < s.T.safe_radius) { sh.pos[0] = L.pos[0] + ux * s.T.safe_radius; sh.pos[2] = L.pos[2] + uz * s.T.safe_radius; }
  }
}

function moveXZ(s, pos, dx, dz) {
  const y = pos[1];
  const ok = (x, z) => { const g = s.map.ground(x, z); return g === null || g <= y + S.step_up; };
  if (ok(pos[0] + dx, pos[2] + dz)) { pos[0] += dx; pos[2] += dz; return; }
  if (ok(pos[0] + dx, pos[2])) { pos[0] += dx; return; }
  if (ok(pos[0], pos[2] + dz)) pos[2] += dz;
}

function pickWanderTarget(s) {
  const pts = s.map.shadeSpawns;
  return [...pts[Math.floor(s.rng() * pts.length)]];
}

function moveToward(pos, target, dist) {
  const [ux, uz, d] = unitXZ(pos, target);
  const k = Math.min(dist, d);
  pos[0] += ux * k; pos[2] += uz * k;
  return d - k;
}

/** One tick. input = held state { move, cam_yaw_deg, jump, interact, pulse, dash, pause }. Returns events. */
export function step(s, input) {
  if (s.state === 'won' || s.state === 'lost') return [];
  const T = s.T, p = s.player, m = s.map, t = s.tick + 1, events = [];
  const emit = (name, data) => events.push({ type: 'event', tick: t, name, data });
  const edge = (k) => !!input[k] && !s.prev[k];
  const E = { jump: edge('jump'), interact: edge('interact'), pulse: edge('pulse'), dash: edge('dash'), pause: edge('pause') };
  for (const k of Object.keys(s.prev)) s.prev[k] = !!input[k];
  s.tick = t;

  // 1. input: pause first
  if (E.pause) {
    s.paused = !s.paused;
    emit(s.paused ? 'paused' : 'resumed', {});
    if (s.paused) return events;
  } else if (s.paused) return events;

  // 2. counters
  s.simTick++;
  s.timeLeftTicks = Math.max(0, s.timeLeftTicks - 1);
  if (p.dashCd > 0) p.dashCd--;
  if (p.pulseCd > 0) p.pulseCd--;
  if (p.invuln > 0) p.invuln--;
  if (p.charm > 0) p.charm--;
  let respawned = false;
  if (p.fallWait > 0 && --p.fallWait === 0 && p.flames > 0) {
    respawned = true;
    p.pos = [...m.start]; p.vel = [0, 0, 0]; p.grounded = true; p.launch = null; p.dashLeft = 0;
    p.invuln = S.invuln_ticks;
  }
  for (const sh of s.shades) {
    if (sh.ticks > 0 && --sh.ticks === 0) {
      if (sh.state === 'spawning' || sh.state === 'stunned' || sh.state === 'recoil') sh.state = 'wander';
    }
  }
  for (const d of s.drifters) if (d.state === 'flee' && d.left > 0 && --d.left === 0) d.state = 'removed';
  for (let i = s.motes.length - 1; i >= 0; i--) {
    const mo = s.motes[i];
    if (mo.ttl != null && --mo.ttl <= 0) s.motes.splice(i, 1);
  }
  for (const c of s.charms) if (!c.available && c.respawn > 0 && --c.respawn === 0) c.available = true;
  if (s.wind.active && --s.wind.left === 0) s.wind.active = false;
  // 2b. lantern fuel: decay 1/s + 5/s per draining shade; then lanterns at fuel <= 0 go out
  for (const L of s.lanterns) {
    if (!L.lit) continue;
    L.fuel -= Math.round((T.fuel_decay_per_s * FU) / TICK_RATE);
    for (const sh of s.shades) {
      if (sh.state !== 'drain' || sh.lantern !== L) continue;
      L.fuel -= Math.round((T.drain_per_s * FU) / TICK_RATE);
      if (++sh.drainTicks % S.drain_event_every === 0) emit('fuel_drain', { lantern_id: L.id, shade_id: sh.id, fuel: r1(Math.max(0, L.fuel) / FU) });
    }
  }
  for (const L of s.lanterns) {
    if (L.lit && L.fuel <= 0) { L.lit = false; L.fuel = 0; L.deposited = 0; emit('lantern_out', { lantern_id: L.id }); }
  }

  // 3. move player (jump, dash, pads, wind), then fall check
  const active = p.fallWait === 0 && !respawned;
  if (active) {
    const speed = p.charm > 0 ? S.charm_speed : T.player_speed;
    const [mx, mz] = input.move ?? [0, 0];
    const th = ((input.cam_yaw_deg ?? 0) * Math.PI) / 180;
    let wx = mx * Math.cos(th) + mz * Math.sin(th), wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }
    const dl = Math.hypot(wx, wz);
    if (dl > EPS) p.facing = [wx / dl, wz / dl];
    if (E.dash && p.dashLeft === 0 && (p.dashCd === 0 || p.charm > 0)) {
      p.dashLeft = S.dash_ticks;
      p.dashCd = secToTicks(T.dash_cooldown_s);
      p.dashDir = [...p.facing]; // moving: facing == move dir; idle: last facing
      emit('dash', {});
    }
    // bounce pad (feet on pad)
    if (p.grounded) {
      for (const pad of m.pads) {
        if (dXZ(p.pos, pad.pos) <= 1 + EPS && Math.abs(p.pos[1] - pad.pos[1]) <= 0.1) {
          p.vel[1] = pad.vy; p.launch = [...pad.hv]; p.grounded = false;
        }
      }
    }
    if (E.jump && p.grounded) { p.vel[1] = S.jump_speed; p.grounded = false; }

    const dashing = p.dashLeft > 0;
    let hx, hz;
    if (dashing) { hx = p.dashDir[0] * T.dash_speed; hz = p.dashDir[1] * T.dash_speed; p.dashLeft--; }
    else if (p.launch) [hx, hz] = p.launch;
    else { hx = wx * speed; hz = wz * speed; }
    if (s.wind.active) {
      const a = (s.wind.dirDeg * Math.PI) / 180;
      hx += Math.cos(a) * S.wind_speed; hz += Math.sin(a) * S.wind_speed;
    }
    moveXZ(s, p.pos, hx / TICK_RATE, hz / TICK_RATE);
    p.vel[0] = hx; p.vel[2] = hz;

    const g = m.ground(p.pos[0], p.pos[2]);
    if (p.grounded) {
      if (g !== null && p.pos[1] - g <= S.step_up) { p.pos[1] = g; p.vel[1] = 0; }
      else p.grounded = false;
    }
    if (!p.grounded) {
      if (dashing) p.vel[1] = 0; // dash keeps height
      else {
        const prevY = p.pos[1];
        p.vel[1] -= S.gravity / TICK_RATE;
        p.pos[1] += p.vel[1] / TICK_RATE;
        if (g !== null && p.vel[1] <= 0 && p.pos[1] <= g && prevY >= g - S.step_up) {
          p.pos[1] = g; p.vel[1] = 0; p.grounded = true; p.launch = null;
        }
      }
    }
    if (p.pos[1] < S.fall_y && T.fall_enabled) {
      p.flames = Math.max(0, p.flames - 1);
      const lost = p.carried;
      p.carried = 0; p.fallWait = S.fall_wait; p.vel = [0, 0, 0]; p.launch = null; p.dashLeft = 0;
      emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
    }
  } else p.vel = [0, 0, 0];
  const canInteract = p.fallWait === 0;

  // 4. pick up motes and charms
  if (canInteract) {
    for (let i = 0; i < s.motes.length && p.carried < capacity(s); i++) {
      const mo = s.motes[i];
      if (dXZ(p.pos, mo.pos) <= T.pickup_radius + EPS && Math.abs(p.pos[1] - mo.pos[1]) <= S.pickup_height + EPS) {
        s.motes.splice(i--, 1);
        p.carried++;
        emit('mote_picked', { carried: p.carried });
      }
    }
    for (const c of s.charms) {
      if (c.available && dXZ(p.pos, c.pos) <= T.pickup_radius + EPS && Math.abs(p.pos[1] - c.pos[1]) <= S.pickup_height + EPS) {
        c.available = false; c.respawn = S.charm_respawn; p.charm = S.charm_ticks;
        emit('charm_picked', { charm_id: c.id, charm_ticks: p.charm });
      }
    }
  }

  // 5. interact with lanterns: light / relight unlit ones, refuel lit ones that are not full
  const zoneRestored = [];
  if (canInteract && E.interact && p.carried > 0) {
    const refuelUse = (L) => Math.min(p.carried, Math.ceil((fuelMax(T) - L.fuel) / (T.fuel_per_mote * FU)));
    let best = null, bestD = Infinity;
    for (const L of s.lanterns) {
      const d = dXZ(p.pos, L.pos);
      if (d > T.interact_radius + EPS || (L.lit && refuelUse(L) === 0)) continue;
      if (d < bestD - EPS || (Math.abs(d - bestD) <= EPS && idNum(L.id) < idNum(best.id))) { best = L; bestD = d; }
    }
    if (best && best.lit) {
      const used = refuelUse(best), wasLow = best.fuel < lowFuel(T);
      best.fuel = Math.min(fuelMax(T), best.fuel + used * T.fuel_per_mote * FU);
      p.carried -= used;
      s.score += used * T.score.per_mote;
      emit('refuel', { lantern_id: best.id, amount: used, fuel: r1(best.fuel / FU) });
      if (wasLow && best.fuel >= lowFuel(T)) zoneRestored.push(best);
    } else if (best) {
      const cost = best.everLit ? T.relight_cost : T.lantern_cost;
      const amount = Math.min(p.carried, cost - best.deposited);
      p.carried -= amount;
      best.deposited += amount;
      s.score += amount * T.score.per_mote;
      emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      if (best.deposited >= cost) {
        const relight = best.everLit;
        best.lit = true; best.fuel = fuelMax(T); best.everLit = true;
        if (relight) best.relitCount++;
        p.successfulLights++;
        s.score += relight ? S.score3.per_relight : T.score.per_lantern;
        zoneRestored.push(best);
        emit('lantern_lit', { lantern_id: best.id, relight });
      }
    }
  }

  // 6. safe zones: shades inside a just-lit (or refuelled back to >= 30) lantern are evicted over <= 30 ticks, harmless meanwhile
  for (const L of zoneRestored) {
    for (const sh of s.shades) {
      if (dXZ(sh.pos, L.pos) < T.safe_radius - EPS) {
        sh.evict = S.evict_ticks; sh.evictFrom = L;
        if (sh.state === 'drain') { sh.state = 'wander'; sh.lantern = null; }
      }
    }
  }

  // 7. pulse
  if (canInteract && E.pulse && p.pulseCd === 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCd = secToTicks(T.pulse_cooldown_s);
    const c = [p.pos[0], p.pos[1] + S.player_center_y, p.pos[2]];
    const d3 = (q) => Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]);
    const ids = [];
    for (const sh of [...s.shades].sort(byId)) {
      if (d3(sh.pos) > T.pulse_radius + EPS) continue;
      s.score += sh.state === 'drain' ? S.score3.per_stun_draining : T.score.per_stun;
      sh.state = 'stunned'; sh.ticks = S.stun_ticks; sh.pushLeft = S.push_ticks; sh.lantern = null; sh.drainTicks = 0;
      const [ux, uz] = unitXZ(p.pos, sh.pos);
      sh.pushDir = [ux, uz];
      ids.push(sh.id);
    }
    for (const d of s.drifters) {
      if (d.state === 'removed' || d3(d.pos) > T.pulse_radius + EPS) continue;
      if (d.state === 'chase' || d.state === 'idle') { d.state = 'flee'; d.left = S.drifter_flee_ticks; }
      else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        for (let i = 0; i < amount; i++) addMote(s, [d.pos[0], m.ground(d.pos[0], d.pos[2]) ?? p.pos[1], d.pos[2]], 'dropped');
        d.stolen = 0; d.left = S.drifter_drop_remove;
        emit('drifter_drop', { drifter_id: d.id, amount });
      }
    }
    emit('pulse', { stunned_ids: ids });
  }

  // 8. move shades and drifters
  const speed = m.shadeSpeed / TICK_RATE;
  for (const sh of s.shades) {
    if (sh.evict > 0) {
      const L = sh.evictFrom, [ux, uz, d] = unitXZ(L.pos, sh.pos), out = (T.safe_radius - d) / sh.evict;
      sh.pos[0] += ux * out; sh.pos[2] += uz * out;
      if (--sh.evict === 0) sh.evictFrom = null;
      continue;
    }
    const dist = dXZ(sh.pos, p.pos);
    const playerTargetable = p.fallWait === 0;
    if (sh.state === 'drain') {
      const L = sh.lantern;
      if (playerTargetable && dist <= S.drain_break_m + EPS) { sh.state = 'chase'; sh.lantern = null; }
      else if (!L || !L.lit || L.fuel >= lowFuel(T) || dXZ(sh.pos, L.pos) > S.drain_range_m + EPS) { sh.state = 'wander'; sh.lantern = null; }
      if (sh.state !== 'drain') sh.drainTicks = 0;
    } else if (sh.state === 'wander' && playerTargetable && dist <= S.shade_detect_m + EPS) { sh.state = 'chase'; sh.lantern = null; }
    else if (sh.state === 'chase' && (!playerTargetable || dist > S.shade_giveup_m + EPS)) sh.state = 'wander';
    if (sh.state === 'chase') moveToward(sh.pos, p.pos, speed);
    else if (sh.state === 'wander') {
      // Ticket-03: nearest weak lit lantern (fuel < 30, tie -> smaller id); else nearest unlit lantern; else roam
      const near = (list) => list.sort((a, b) => dXZ(sh.pos, a.pos) - dXZ(sh.pos, b.pos) || idNum(a.id) - idNum(b.id))[0];
      const weak = near(s.lanterns.filter((L) => L.lit && L.fuel < lowFuel(T)));
      const goal = weak ?? near(s.lanterns.filter((L) => !L.lit));
      sh.lantern = goal ?? null;
      if (goal) {
        if (weak && dXZ(sh.pos, weak.pos) <= S.drain_range_m + EPS) { sh.state = 'drain'; sh.drainTicks = 0; }
        else moveToward(sh.pos, goal.pos, S.shade_wander_speed / TICK_RATE);
      } else {
        if (!sh.target) sh.target = pickWanderTarget(s, sh.pos);
        if (moveToward(sh.pos, sh.target, S.shade_wander_speed / TICK_RATE) <= EPS) sh.target = null;
      }
    } else if (sh.state === 'stunned' && sh.pushLeft > 0) {
      const k = T.pulse_push_m / S.push_ticks;
      const nx = sh.pos[0] + sh.pushDir[0] * k, nz = sh.pos[2] + sh.pushDir[1] * k;
      const g = m.ground(nx, nz);
      if (g !== null && g > sh.pos[1] + S.step_up + 2) sh.pushLeft = 0; // obstacle (bell tower / cliff) stops the push
      else { sh.pos[0] = nx; sh.pos[2] = nz; sh.pushLeft--; }
    } else if (sh.state === 'recoil') {
      const [ux, uz] = unitXZ(p.pos, sh.pos);
      sh.pos[0] += ux * (S.recoil_m / S.recoil_ticks); sh.pos[2] += uz * (S.recoil_m / S.recoil_ticks);
    }
    const g = m.ground(sh.pos[0], sh.pos[2]);
    if (g !== null && g < 14) sh.pos[1] = g;
    blockBySafeZones(s, sh);
  }
  for (const d of s.drifters) {
    if (d.state === 'removed') continue;
    const dist = dXZ(d.pos, p.pos);
    const want = p.fallWait === 0 && p.carried >= S.drifter_min_carry && dist <= S.drifter_detect_m + EPS;
    if (d.state === 'idle' && want) d.state = 'chase';
    else if (d.state === 'chase' && !want) d.state = 'idle';
    if (d.state === 'chase') { moveToward(d.pos, p.pos, S.drifter_speed / TICK_RATE); d.pos[1] = p.pos[1] + S.drifter_y; }
    else if (d.state === 'flee') {
      const [ux, uz] = unitXZ(p.pos, d.pos);
      d.pos[0] += ux * (S.drifter_speed / TICK_RATE); d.pos[2] += uz * (S.drifter_speed / TICK_RATE);
    } else {
      if (!d.target) d.target = pickWanderTarget(s, d.pos);
      if (moveToward(d.pos, d.target, S.drifter_idle_speed / TICK_RATE) <= EPS) d.target = null;
    }
  }

  // 9. touches: drifters steal first, then shades hit (ascending id)
  if (p.fallWait === 0) {
    for (const d of [...s.drifters].sort(byId)) {
      if (d.state !== 'chase' || dXZ(d.pos, p.pos) > S.drifter_touch_m + EPS) continue;
      const amount = Math.min(S.drifter_steal, p.carried);
      p.carried -= amount; d.stolen = amount; d.state = 'flee'; d.left = S.drifter_flee_ticks;
      emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
    }
    for (const sh of [...s.shades].sort(byId)) {
      if ((sh.state !== 'chase' && sh.state !== 'wander') || sh.evict > 0) continue;
      if (dXZ(sh.pos, p.pos) > T.shade_hit_radius + EPS || Math.abs(sh.pos[1] - p.pos[1]) > S.hit_height + EPS) continue;
      if (p.invuln > 0) continue; // touching an invulnerable player does nothing
      p.flames = Math.max(0, p.flames - 1);
      const dropped = Math.floor(p.carried * T.hit_drop_ratio);
      p.carried -= dropped;
      dropMotes(s, p.pos, dropped);
      p.invuln = S.invuln_ticks;
      sh.state = 'recoil'; sh.ticks = S.recoil_ticks;
      emit('player_hit', { by: 'shade', flames: p.flames, dropped });
      break; // max 1 flame per tick; player is now invulnerable
    }
  }

  // 10. spawns (new entities interact from next tick)
  const st = s.simTick;
  if (s.randomMotes && st % S.mote_spawn_every === 0 && s.motes.length < S.motes_cap) {
    const free = m.moteSpawns.filter((pt) => !s.motes.some((mo) => dXZ(mo.pos, pt) < 0.5 && Math.abs(mo.pos[1] - pt[1]) < 0.5));
    if (free.length) addMote(s, free[Math.floor(s.rng() * free.length)], 'random');
  }
  if (s.randomShades && st >= S.shade_first_spawn && (st - S.shade_first_spawn) % m.shadeEvery === 0) {
    const n = st === S.shade_first_spawn ? 2 : 1;
    for (let i = 0; i < n && s.shades.length < m.shadeMax; i++) {
      const valid = m.shadeSpawns.filter((pt) => dXZ(pt, p.pos) >= 15 - EPS && !inSafeZone(s, pt) && !s.shades.some((sh) => dXZ(sh.pos, pt) < 0.5));
      if (!valid.length) break;
      const pt = valid[Math.floor(s.rng() * valid.length)];
      const sh = newShade(`S${s.nextShade++}`, pt, 'spawning', S.spawning_ticks);
      s.shades.push(sh);
      emit('shade_spawned', { id: sh.id });
    }
  }
  if (s.randomDrifters && st % S.drifter_every === 0 && s.drifters.filter((d) => d.state !== 'removed').length < S.drifter_max) {
    const pt = m.shadeSpawns[Math.floor(s.rng() * m.shadeSpawns.length)];
    s.drifters.push({ id: `D${s.nextDrifter++}`, pos: [pt[0], pt[1] + S.drifter_y, pt[2]], state: 'idle', stolen: 0, left: 0, target: null });
  }
  if (s.windEnabled && st % S.wind_every === 0) {
    s.wind = { active: true, dirDeg: Math.floor(s.rng() * 360), left: S.wind_ticks };
  }

  // 11. win / lose
  let over = null;
  if (p.flames <= 0) over = { result: 'lost', reason: 'no_flames' };
  else if (s.timeLeftTicks <= 0) {
    const litNow = s.lanterns.filter((L) => L.lit).length;
    over = litNow >= winNeed(s) ? { result: 'won', reason: 'dawn_survived' } : { result: 'lost', reason: 'dawn' };
  }
  if (over) {
    if (over.result === 'won') {
      for (const L of s.lanterns) if (L.lit) s.score += S.score3.dawn_per_lit_lantern + Math.floor(L.fuel / FU);
      s.score += p.flames * T.score.per_flame_left;
    }
    s.state = over.result; s.result = over;
    emit('game_over', over);
  }
  return events;
}

export function windWarning(s) {
  return s.windEnabled && !s.wind.active && s.simTick % S.wind_every >= S.wind_every - S.wind_warn_ticks;
}

export function snapshot(s) {
  const p = s.player, sec = (ticks) => r3(ticks / TICK_RATE);
  return {
    type: 'snapshot', tick: s.tick, sim_tick: s.simTick, night: s.night,
    state: s.paused && s.state === 'playing' ? 'paused' : s.state,
    time_left_s: sec(s.timeLeftTicks), score: s.score,
    wind: { active: s.wind.active, dir_deg: s.wind.dirDeg },
    player: {
      pos: p.pos.map(r3), vel: p.vel.map(r3), grounded: p.grounded, flames: p.flames, carried: p.carried, capacity: capacity(s),
      invuln: sec(p.invuln), dash_cd_s: sec(p.dashCd), pulse_cd_s: sec(p.pulseCd), charm_s: sec(p.charm),
    },
    lanterns: s.lanterns.map((L) => ({ id: L.id, pos: L.pos.map(r3), lit: L.lit, deposited: L.deposited, fuel: r1(L.lit ? L.fuel / FU : 0), ever_lit: L.everLit, relit_count: L.relitCount })),
    shades: s.shades.map((sh) => ({ id: sh.id, pos: sh.pos.map(r3), state: sh.state })),
    motes_active: s.motes.length,
    motes: s.motes.map((mo) => ({ id: mo.id, pos: mo.pos.map(r3), kind: mo.kind, ttl_s: mo.ttl == null ? null : sec(mo.ttl) })),
    drifters: s.drifters.map((d) => ({ id: d.id, pos: d.pos.map(r3), state: d.state, stolen: d.stolen })),
    charms: s.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: sec(c.respawn) })),
  };
}
