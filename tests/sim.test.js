import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createSim, step, snapshot, makeRng } from '../src/core/sim.js';

test('rng is deterministic for the same seed', () => {
  const a = makeRng(42), b = makeRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test('player moves 4 units in 1 second at moveX=1', () => {
  const sim = createSim({ seed: 1 });
  for (let i = 0; i < 60; i++) step(sim, { moveX: 1 });
  assert.deepEqual(snapshot(sim), { tick: 60, player: { x: 4, y: 0, z: 0 } });
});

test('headless CLI: same input twice gives identical output', () => {
  const run = () => execFileSync(process.execPath, ['src/headless/cli.js', 'tests/scenarios/hello.json'], { encoding: 'utf8' });
  const first = run();
  assert.equal(first, run());
  assert.deepEqual(JSON.parse(first), { tick: 30, player: { x: 1, y: 0, z: -1 } });
});
