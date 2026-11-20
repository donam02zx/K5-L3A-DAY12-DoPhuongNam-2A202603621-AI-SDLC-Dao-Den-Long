#!/usr/bin/env node
// Ticket-04 §2 soak test: 10 nights back-to-back in ONE process (1 -> 2 -> 3 -> 1 ...), night i uses seed + i,
// seeded random inputs (new move dir every 30 ticks; per tick 5% jump, 3% dash, 2% pulse, 10% interact).
// Usage: node --expose-gc scripts/soak.mjs --seed 7 --nights 10 --out soak.json
import { writeFileSync } from 'node:fs';
import { createSim, step, snapshot, makeRng, nightDuration, TICK_RATE } from '../src/core/sim.js';
import { TUNING } from '../src/core/tuning.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith('--') ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const seed = parseInt(args.seed ?? '7', 10), nights = parseInt(args.nights ?? '10', 10), out = args.out ?? 'soak.json';
if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) { console.error('error: --seed <int> --nights <int >= 1> --out <file>'); process.exit(2); }

const gc = globalThis.gc ?? (() => {});
const rssMb = () => { for (let i = 0; i < 3; i++) gc(); return +(process.memoryUsage().rss / 1048576).toFixed(1); };
const t0 = Date.now();
const results = [];
let crashes = 0, memStart = null, memEnd = null, heapStart = null, sim = null;

for (let i = 0; i < nights; i++) {
  const night = (i % 3) + 1;
  try {
    sim = createSim({ seed: seed + i, night });
    if (i === 0) { memStart = rssMb(); heapStart = +(process.memoryUsage().heapUsed / 1048576).toFixed(1); } // after the first night is loaded
    const rng = makeRng((seed + i) ^ 0x5eed);
    const held = { move: [0, 0], cam_yaw_deg: 0, jump: false, dash: false, pulse: false, interact: false, pause: false };
    const maxTicks = nightDuration(TUNING, night) * TICK_RATE;
    let lines = 0;
    for (let k = 0; k < maxTicks && sim.state === 'playing'; k++) {
      if (k % 30 === 0) { const a = rng() * 2 * Math.PI; held.move = [Math.cos(a), Math.sin(a)]; }
      held.jump = rng() < 0.05; held.dash = rng() < 0.03; held.pulse = rng() < 0.02; held.interact = rng() < 0.1;
      lines += step(sim, held).length;
      if (sim.tick % 10 === 0) lines += snapshot(sim).shades.length >= 0 ? 1 : 0; // build snapshots like the headless runner
    }
    results.push(sim.state === 'won' ? 'won' : 'lost');
  } catch (e) {
    crashes++;
    results.push('crash');
    console.error(`night ${i + 1} crashed: ${e.stack}`);
  }
  sim = null; // reset between nights
}
// "after the last night has been reset": drop the sim, let V8 finish collecting and shrink its heap, then measure
await new Promise((r) => setTimeout(r, 1000));
memEnd = rssMb();
const heapMb = +(process.memoryUsage().heapUsed / 1048576).toFixed(1);
const report = { nights, crashes, results, mem_start_mb: memStart, mem_end_mb: memEnd, duration_s: +((Date.now() - t0) / 1000).toFixed(1), heap_start_mb: heapStart, heap_end_mb: heapMb, node: process.version };
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
