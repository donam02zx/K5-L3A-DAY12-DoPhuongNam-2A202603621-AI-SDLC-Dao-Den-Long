// Ticket-04 (Contract v1.3): leaderboard rules + export, bench scene, soak runner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validName, insertEntry, sortEntries, isoWithOffset, LB_MAX } from '../src/core/leaderboard.js';
import { createSim, step, snapshot } from '../src/core/sim.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'ddl4-'));

test('contract v1.3 declares bench_cmd and soak_cmd', () => {
  const c = JSON.parse(readFileSync('game.contract.json', 'utf8'));
  assert.equal(c.contract_version, '1.3');
  assert.ok(c.bench_cmd && c.soak_cmd && c.run_cmd && c.headless_cmd && c.build_cmd);
});

test('leaderboard: name rule 3-12 [A-Za-z0-9_] (+ Vietnamese letters)', () => {
  for (const ok of ['May', 'abc_123', 'ABCDEFGHIJKL', 'Mây_đẹp']) assert.ok(validName(ok), ok);
  for (const bad of ['ab', 'ABCDEFGHIJKLM', 'a b c', 'abc!', '', null]) assert.ok(!validName(bad), String(bad));
});

test('leaderboard: score desc, ties -> earlier first, top 10 only', () => {
  let lb = [];
  lb = insertEntry(lb, { name: 'late', score: 500, nights_won: 1, seed: 1, achieved_at: '2026-11-20T10:00:00+07:00' });
  lb = insertEntry(lb, { name: 'early', score: 500, nights_won: 1, seed: 2, achieved_at: '2026-11-20T09:00:00+07:00' });
  lb = insertEntry(lb, { name: 'best', score: 900, nights_won: 3, seed: 3, achieved_at: '2026-11-20T11:00:00+07:00' });
  assert.deepEqual(lb.map((e) => e.name), ['best', 'early', 'late']);
  for (let i = 0; i < 12; i++) lb = insertEntry(lb, { name: `p${i}xx`, score: i, nights_won: 0, seed: i, achieved_at: isoWithOffset() });
  assert.equal(lb.length, LB_MAX);
  assert.equal(lb.at(-1).score, 5);
  assert.deepEqual(sortEntries(lb), lb);
  assert.match(isoWithOffset(), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  assert.throws(() => insertEntry(lb, { name: 'x', score: 1, nights_won: 0, seed: 1 }));
  assert.throws(() => insertEntry(lb, { name: 'okay', score: 1, nights_won: 4, seed: 1 }));
});

test('leaderboard: persisted file + run_cmd --export-leaderboard writes {"entries": [...]} in order', () => {
  const dir = tmp(), store = join(dir, 'lb.json'), out = join(dir, 'out.json');
  writeFileSync(store, JSON.stringify({ entries: [
    { name: 'bbb', score: 10, nights_won: 0, achieved_at: '2026-11-20T10:00:00+07:00', seed: 1 },
    { name: 'aaa', score: 20, nights_won: 1, achieved_at: '2026-11-20T10:00:00+07:00', seed: 2 },
  ] }));
  const r = spawnSync(process.execPath, ['scripts/serve.mjs', '--export-leaderboard', out], { encoding: 'utf8', env: { ...process.env, DDL_LEADERBOARD: store } });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')).entries.map((e) => e.name), ['aaa', 'bbb']);
});

test('bench scene: 200 wandering shades, 100 motes, L1-L3 lit fuel 100; no damage/pickup/decay/end', () => {
  const s = createSim({ bench: true, seed: 42 });
  let sn = snapshot(s);
  assert.equal(sn.shades.length, 200);
  assert.ok(sn.shades.every((x) => x.state === 'wander'));
  assert.equal(sn.motes_active, 100);
  assert.deepEqual(sn.lanterns.map((l) => [l.lit, l.fuel]), [[true, 100], [true, 100], [true, 100], [false, 0], [false, 0]]);
  for (let i = 0; i < 300 * 60; i++) step(s, {});
  sn = snapshot(s);
  assert.equal(sn.state, 'playing');
  assert.equal(sn.player.flames, 3);
  assert.equal(sn.shades.length, 200);
  assert.equal(sn.motes_active, 100);
  assert.ok(sn.lanterns.slice(0, 3).every((l) => l.fuel === 100));
  assert.deepEqual(sn.player.pos, [0, 0, 0]);
  // deterministic with seed 42
  assert.deepEqual(snapshot(createSim({ bench: true, seed: 42 })).shades[0], snapshot(createSim({ bench: true, seed: 42 })).shades[0]);
});

test('soak: 10 nights in one process, 0 crashes, mem_end <= 1.2 x mem_start', () => {
  const out = join(tmp(), 'soak.json');
  const r = spawnSync(process.execPath, ['--expose-gc', 'scripts/soak.mjs', '--seed', '7', '--nights', '10', '--out', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(j.nights, 10);
  assert.equal(j.results.length, 10);
  assert.equal(j.crashes, 0);
  assert.ok(j.mem_end_mb <= 1.2 * j.mem_start_mb, JSON.stringify(j));
});
