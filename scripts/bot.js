#!/usr/bin/env node
// Greedy bot that plays a full default Night 1 using the core sim and records an inputs file.
// Usage: node scripts/bot.js <seed> <out-inputs.json>
// Proof: replay the recorded inputs through the headless CLI and check the game_over event.
import { writeFileSync } from 'node:fs';
import { createSim, step } from '../src/core/sim.js';
import { TUNING as T } from '../src/core/tuning.js';

const seed = parseInt(process.argv[2] ?? '1', 10);
const out = process.argv[3] ?? 'bot-inputs.json';
const sim = createSim({ seed });
const frames = [];
let prev = null;
const d = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

while (sim.state === 'playing' && sim.tick < T.night1_duration_s * 60) {
  const p = sim.player;
  const unlit = sim.lanterns.filter((L) => !L.lit).sort((a, b) => d(p.pos, a.pos) - d(p.pos, b.pos));
  const need = unlit.reduce((n, L) => n + T.lantern_cost - L.deposited, 0);
  const wantMotes = p.carried < Math.min(T.carry_capacity, need) && sim.motes.length > 0;
  const target = wantMotes ? [...sim.motes].sort((a, b) => d(p.pos, a.pos) - d(p.pos, b.pos))[0].pos : unlit[0].pos;
  const dist = d(p.pos, target);
  const near = !wantMotes && dist <= T.interact_radius - 0.5;
  const move = near ? [0, 0] : [(target[0] - p.pos[0]) / dist, (target[2] - p.pos[2]) / dist].map((v) => Math.round(v * 1000) / 1000);
  const threat = sim.shades.some((s) => s.stun === 0 && d(p.pos, s.pos) < 2.5);
  const input = {
    move,
    cam_yaw_deg: 0,
    interact: near && !(prev?.interact),
    pulse: threat && p.pulseCd === 0 && p.carried >= T.pulse_cost && !(prev?.pulse),
  };
  const f = { tick: sim.tick };
  for (const k of Object.keys(input)) if (!prev || JSON.stringify(prev[k]) !== JSON.stringify(input[k])) f[k] = input[k];
  if (Object.keys(f).length > 1) frames.push(f);
  prev = input;
  step(sim, input);
}
writeFileSync(out, JSON.stringify({ frames }) + '\n');
console.log(JSON.stringify({ seed, ticks: sim.tick, state: sim.state, result: sim.result, score: sim.score, frames: frames.length }));
