#!/usr/bin/env node
// Headless runner. Placeholder format until PRD-0's Test Contract is read;
// then this file is rewritten to match the contract exactly.
//
// Usage: node src/headless/cli.js [scenario.json]
//   scenario: { "seed": 1, "ticks": 60, "inputs": [{ "moveX": 1 }, ...] }
import { readFileSync } from 'node:fs';
import { createSim, step, snapshot } from '../core/sim.js';

const path = process.argv[2];
const scenario = path ? JSON.parse(readFileSync(path, 'utf8')) : { seed: 1, ticks: 60, inputs: [] };

const sim = createSim({ seed: scenario.seed });
for (let i = 0; i < (scenario.ticks ?? 0); i++) {
  step(sim, scenario.inputs?.[i] ?? scenario.inputs?.at?.(-1) ?? {});
}
process.stdout.write(JSON.stringify(snapshot(sim)) + '\n');
