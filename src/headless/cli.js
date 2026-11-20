#!/usr/bin/env node
// Test Contract v1.0 headless runner.
// node src/headless/cli.js --seed <int> --night 1 [--scenario f.json] [--inputs f.json]
//                          --ticks <int> --out <file.jsonl> [--snapshot-every <int>]
import { readFileSync, writeFileSync } from 'node:fs';
import { createSim, step, snapshot } from '../core/sim.js';
import { TUNING } from '../core/tuning.js';

class UsageError extends Error {}
const fail = (msg) => { throw new UsageError(msg); };

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const BUTTONS = ['jump', 'interact', 'pulse', 'dash'];

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) fail(`unexpected argument: ${k}`);
    const v = argv[++i];
    if (v === undefined) fail(`missing value for ${k}`);
    a[k.slice(2)] = v;
  }
  const int = (name, def) => {
    if (a[name] === undefined) { if (def === undefined) fail(`--${name} is required`); return def; }
    if (!/^-?\d+$/.test(a[name])) fail(`--${name} must be an integer`);
    return parseInt(a[name], 10);
  };
  const out = {
    seed: int('seed'), night: int('night', 1), ticks: int('ticks'),
    every: int('snapshot-every', 10), out: a.out, scenario: a.scenario, inputs: a.inputs,
  };
  if (!out.out) fail('--out is required');
  if (out.night !== 1) fail(`unsupported --night ${out.night} (only 1)`);
  if (out.ticks < 0) fail('--ticks must be >= 0');
  if (out.every < 1) fail('--snapshot-every must be >= 1');
  return out;
}

function readJson(path, what) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch (e) { fail(`cannot read ${what} file ${path}: ${e.message}`); }
  try { return JSON.parse(text); } catch (e) { fail(`${what} file is not valid JSON: ${e.message}`); }
}

export function validateInputs(j) {
  if (!isObj(j) || !Array.isArray(j.frames)) fail('inputs: expected {"frames": [...]}');
  let last = -1;
  j.frames.forEach((f, i) => {
    const at = `inputs.frames[${i}]`;
    if (!isObj(f)) fail(`${at}: must be an object`);
    if (!isInt(f.tick) || f.tick < 0) fail(`${at}.tick must be an integer >= 0`);
    if (f.tick <= last) fail(`${at}.tick must be strictly increasing`);
    last = f.tick;
    if ('move' in f && !(Array.isArray(f.move) && f.move.length === 2 && f.move.every((v) => isNum(v) && v >= -1 && v <= 1)))
      fail(`${at}.move must be [x, z] with values in [-1, 1]`);
    if ('cam_yaw_deg' in f && !isNum(f.cam_yaw_deg)) fail(`${at}.cam_yaw_deg must be a number`);
    for (const b of BUTTONS) if (b in f && typeof f[b] !== 'boolean') fail(`${at}.${b} must be boolean`);
  });
  return j.frames;
}

export function validateScenario(j) {
  if (!isObj(j)) fail('scenario: must be an object');
  if ('player' in j) {
    const p = j.player;
    if (!isObj(p)) fail('scenario.player must be an object');
    if ('pos' in p && !isVec3(p.pos)) fail('scenario.player.pos must be [x, y, z]');
    for (const k of ['carried', 'flames']) if (k in p && !(isInt(p[k]) && p[k] >= 0)) fail(`scenario.player.${k} must be an integer >= 0`);
  }
  for (const k of ['random_motes', 'random_shades']) if (k in j && typeof j[k] !== 'boolean') fail(`scenario.${k} must be boolean`);
  if ('motes' in j) {
    if (!Array.isArray(j.motes)) fail('scenario.motes must be an array');
    j.motes.forEach((m, i) => { if (!isVec3(m) && !(isObj(m) && isVec3(m.pos))) fail(`scenario.motes[${i}] must be [x, y, z]`); });
  }
  if ('shades' in j) {
    if (!Array.isArray(j.shades)) fail('scenario.shades must be an array');
    const ids = new Set();
    j.shades.forEach((s, i) => {
      if (!isObj(s) || !isVec3(s.pos)) fail(`scenario.shades[${i}].pos must be [x, y, z]`);
      if ('id' in s) {
        if (typeof s.id !== 'string' || ids.has(s.id)) fail(`scenario.shades[${i}].id must be a unique string`);
        ids.add(s.id);
      }
    });
  }
  if ('lanterns' in j) {
    if (!Array.isArray(j.lanterns)) fail('scenario.lanterns must be an array');
    const valid = new Set(Array.from({ length: TUNING.lantern_count_night1 }, (_, k) => `L${k + 1}`));
    j.lanterns.forEach((l, i) => {
      const at = `scenario.lanterns[${i}]`;
      if (!isObj(l) || !valid.has(l.id)) fail(`${at}.id must be one of ${[...valid].join(', ')}`);
      if ('pos' in l && !isVec3(l.pos)) fail(`${at}.pos must be [x, y, z]`);
      if ('deposited' in l && !(isInt(l.deposited) && l.deposited >= 0)) fail(`${at}.deposited must be an integer >= 0`);
      if ('lit' in l && typeof l.lit !== 'boolean') fail(`${at}.lit must be boolean`);
    });
  }
  if ('time_left_s' in j && !(isNum(j.time_left_s) && j.time_left_s >= 0)) fail('scenario.time_left_s must be a number >= 0');
  return j;
}

export function run(opts) {
  const scenario = opts.scenario ? validateScenario(readJson(opts.scenario, 'scenario')) : null;
  const frames = opts.inputs ? validateInputs(readJson(opts.inputs, 'inputs')) : [];
  const sim = createSim({ seed: opts.seed, scenario });
  const lines = [JSON.stringify(snapshot(sim))];
  const held = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
  let fi = 0;
  let k = 0;
  for (; k < opts.ticks && sim.state === 'playing'; k++) {
    while (fi < frames.length && frames[fi].tick <= k) {
      const f = frames[fi++];
      for (const key of Object.keys(held)) if (key in f) held[key] = f[key];
    }
    for (const e of step(sim, held)) lines.push(JSON.stringify(e));
    if (sim.tick % opts.every === 0) lines.push(JSON.stringify(snapshot(sim)));
  }
  lines.push(JSON.stringify({ type: 'end', ticks: k, state: sim.state, score: sim.score }));
  writeFileSync(opts.out, lines.join('\n') + '\n');
}

try {
  run(parseArgs(process.argv.slice(2)));
} catch (e) {
  process.stderr.write(`error: ${e.message}\n`);
  process.exit(e instanceof UsageError ? 2 : 1);
}
