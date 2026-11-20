#!/usr/bin/env node
// Greedy bot that plays a full default night using the core sim and records an inputs file.
// Usage: node scripts/bot.js <seed> <out-inputs.json> [night=1]
// Proof: replay the recorded inputs through the headless CLI and check the game_over event.
import { writeFileSync } from 'node:fs';
import { createSim, step, nightDuration } from '../src/core/sim.js';
import { TUNING as T } from '../src/core/tuning.js';

const seed = parseInt(process.argv[2] ?? '1', 10);
const out = process.argv[3] ?? 'bot-inputs.json';
const night = parseInt(process.argv[4] ?? '1', 10);
const sim = createSim({ seed, night });
const d = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const C30 = [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)];

// --- navigation: returns the next waypoint towards `to` ---
const island2 = (p) => (p[0] < 35 ? 'A' : 'B');
const tier3 = (p) => (p[1] > 4.5 ? 2 : p[1] > 1.5 ? 1 : 0);
function waypoint(from, to) {
  if (night === 2 && island2(from) !== island2(to)) {
    const [near, far] = island2(from) === 'A' ? [[24, 0, 0], [46, 0, 0]] : [[46, 0, 0], [24, 0, 0]];
    if (Math.abs(from[2]) > 1.2 || (island2(from) === 'A' ? from[0] < 23 : from[0] > 47)) return near;
    return far;
  }
  if (night === 3) {
    const a = tier3(from), b = tier3(to);
    if (b > a) {
      if (a === 0) return d(from, [31 * C30[0], 0, 31 * C30[1]]) > 0.6 ? [31 * C30[0], 0, 31 * C30[1]] : [18 * C30[0], 3, 18 * C30[1]];
      if (a === 1) return [0, 3, 13]; // pad up to tier 2
    }
    if (b < a) {
      if (a === 2) return [0, 6, -12]; // walk off the south edge of tier 2 (no tier 1 at z < 0)
      if (a === 1) { const r = Math.hypot(from[0], from[2]); return [(from[0] / r) * 27, 0, (from[2] / r) * 27]; }
    }
    if (a === 0 && b === 0 && segmentHitsTier(from, to)) return [Math.sign(from[0] + to[0] || 1) * 28, 0, -2];
  }
  return to;
}
function segmentHitsTier(a, b) {
  for (let i = 1; i < 20; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / 20, z = a[2] + ((b[2] - a[2]) * i) / 20;
    const r = Math.hypot(x, z);
    if (r <= 9 || (z > -0.5 && r >= 11 && r <= 25)) return true;
  }
  return false;
}

const frames = [];
let prev = null;
while (sim.state === 'playing' && sim.simTick < nightDuration(T, night) * 60) {
  const p = sim.player;
  const unlit = sim.lanterns.filter((L) => !L.lit).sort((a, b) => d(p.pos, a.pos) - d(p.pos, b.pos));
  const need = unlit.reduce((n, L) => n + T.lantern_cost - L.deposited, 0);
  const goal = Math.min(T.carry_capacity, need + T.pulse_cost);
  const danger = (q) => sim.shades.filter((s) => s.state !== 'stunned' && d(q, s.pos) < 7).length * 25;
  const cost = (q) => d(p.pos, q) + danger(q);
  const motes = sim.motes.filter((m) => Math.abs(m.pos[1] - p.pos[1]) < 1 || night !== 3).sort((a, b) => cost(a.pos) - cost(b.pos));
  const anyMotes = motes.length ? motes : [...sim.motes].sort((a, b) => d(p.pos, a.pos) - d(p.pos, b.pos));
  const wantMotes = p.carried < goal && anyMotes.length > 0;
  const target = wantMotes ? anyMotes[0].pos : unlit[0].pos;
  const wp = p.grounded ? waypoint(p.pos, target) : target;
  const dist = d(p.pos, wp);
  const atLantern = !wantMotes && wp === target && d(p.pos, target) <= T.interact_radius - 0.4 && Math.abs(p.pos[1] - target[1]) < 1;
  let move = atLantern || dist < 1e-6 ? [0, 0] : [(wp[0] - p.pos[0]) / dist, (wp[2] - p.pos[2]) / dist];
  const threats = sim.shades.filter((s) => (s.state === 'chase' || s.state === 'wander') && d(p.pos, s.pos) < 4.5 && Math.abs(s.pos[1] - p.pos[1]) < 2);
  const chasers = sim.shades.filter((s) => s.state === 'chase' && d(p.pos, s.pos) < 6);
  const canPulse = p.pulseCd === 0 && p.carried >= T.pulse_cost;
  let dash = false;
  const inSafe = sim.lanterns.some((L) => L.lit && d(p.pos, L.pos) < 5);
  if (chasers.length && !canPulse && !inSafe && p.invuln === 0) {
    const s = chasers[0], ax = p.pos[0] - s.pos[0], az = p.pos[2] - s.pos[2], al = Math.hypot(ax, az) || 1;
    move = [ax / al, az / al];
    dash = p.dashCd === 0 && d(p.pos, s.pos) < 3 && (night !== 2 || Math.abs(p.pos[2]) > 3);
    const lit = sim.lanterns.filter((L) => L.lit).sort((a, b) => d(p.pos, a.pos) - d(p.pos, b.pos))[0];
    if (lit && d(p.pos, lit.pos) < 15) { const lx = lit.pos[0] - p.pos[0], lz = lit.pos[2] - p.pos[2], ll = Math.hypot(lx, lz) || 1; move = [lx / ll, lz / ll]; } // no dashing on the narrow bridge
  }
  const input = {
    move: move.map((v) => Math.round(v * 1000) / 1000),
    cam_yaw_deg: 0,
    interact: atLantern && !prev?.interact,
    pulse: threats.length > 0 && canPulse && !prev?.pulse,
    dash: dash && !prev?.dash,
  };
  const f = { tick: sim.tick };
  for (const k of Object.keys(input)) if (!prev || JSON.stringify(prev[k]) !== JSON.stringify(input[k])) f[k] = input[k];
  if (Object.keys(f).length > 1) frames.push(f);
  prev = input;
  step(sim, input);
}
writeFileSync(out, JSON.stringify({ frames }) + '\n');
console.log(JSON.stringify({ night, seed, ticks: sim.tick, state: sim.state, result: sim.result, score: sim.score, lit: sim.lanterns.filter((l) => l.lit).length }));
