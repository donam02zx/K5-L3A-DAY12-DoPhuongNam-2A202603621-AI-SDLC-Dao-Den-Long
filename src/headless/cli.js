#!/usr/bin/env node
// Test Contract v1.2 headless runner.
// node src/headless/cli.js --seed <int> --night <1|2|3> [--scenario f.json] [--inputs f.json]
//                          --ticks <int> --out <file.jsonl> [--snapshot-every <int>]
import { readFileSync, writeFileSync } from 'node:fs';
import { createSim, step, snapshot } from '../core/sim.js';
import { NIGHTS } from '../core/maps.js';

class UsageError extends Error {}
const fail = (msg) => { throw new UsageError(msg); };

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];
const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
const DRIFTER_STATES = ['idle', 'chase', 'flee', 'removed'];
const nonNegInt = (v) => isInt(v) && v >= 0;

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
  if (![1, 2, 3].includes(out.night)) fail(`unsupported --night ${out.night} (1, 2 or 3)`);
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

export function validateScenario(j, night) {
  if (!isObj(j)) fail('scenario: must be an object');
  if ('player' in j) {
    const p = j.player;
    if (!isObj(p)) fail('scenario.player must be an object');
    if ('pos' in p && !isVec3(p.pos)) fail('scenario.player.pos must be [x, y, z]');
    for (const k of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks', 'successful_lights']) if (k in p && !nonNegInt(p[k])) fail(`scenario.player.${k} must be an integer >= 0`);
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) if (k in j && typeof j[k] !== 'boolean') fail(`scenario.${k} must be boolean`);
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
      if ('state' in s && !SHADE_STATES.includes(s.state)) fail(`scenario.shades[${i}].state must be one of ${SHADE_STATES.join(', ')}`);
      if ('state_ticks_left' in s && !nonNegInt(s.state_ticks_left)) fail(`scenario.shades[${i}].state_ticks_left must be an integer >= 0`);
      if ('target_lantern_id' in s && !NIGHTS[night].lanterns.some((l) => l.id === s.target_lantern_id)) fail(`scenario.shades[${i}].target_lantern_id is not a lantern of night ${night}`);
    });
  }
  if ('lanterns' in j) {
    if (!Array.isArray(j.lanterns)) fail('scenario.lanterns must be an array');
    const valid = new Set(NIGHTS[night].lanterns.map((l) => l.id));
    j.lanterns.forEach((l, i) => {
      const at = `scenario.lanterns[${i}]`;
      if (!isObj(l) || !valid.has(l.id)) fail(`${at}.id must be one of ${[...valid].join(', ')}`);
      if ('pos' in l && !isVec3(l.pos)) fail(`${at}.pos must be [x, y, z]`);
      if ('deposited' in l && !(isInt(l.deposited) && l.deposited >= 0)) fail(`${at}.deposited must be an integer >= 0`);
      if ('lit' in l && typeof l.lit !== 'boolean') fail(`${at}.lit must be boolean`);
      if ('ever_lit' in l && typeof l.ever_lit !== 'boolean') fail(`${at}.ever_lit must be boolean`);
      if ('fuel' in l && !(isNum(l.fuel) && l.fuel >= 0 && l.fuel <= 100)) fail(`${at}.fuel must be a number in [0, 100]`);
    });
  }
  if ('drifters' in j) {
    if (!Array.isArray(j.drifters)) fail('scenario.drifters must be an array');
    j.drifters.forEach((d, i) => {
      if (!isObj(d) || !isVec3(d.pos)) fail(`scenario.drifters[${i}].pos must be [x, y, z]`);
      if ('state' in d && !DRIFTER_STATES.includes(d.state)) fail(`scenario.drifters[${i}].state must be one of ${DRIFTER_STATES.join(', ')}`);
      if ('stolen' in d && !nonNegInt(d.stolen)) fail(`scenario.drifters[${i}].stolen must be an integer >= 0`);
      if ('id' in d && typeof d.id !== 'string') fail(`scenario.drifters[${i}].id must be a string`);
    });
  }
  if ('charms' in j) {
    if (!Array.isArray(j.charms)) fail('scenario.charms must be an array');
    j.charms.forEach((c, i) => {
      if (!isObj(c) || typeof c.id !== 'string') fail(`scenario.charms[${i}].id must be a string`);
      if ('pos' in c && !isVec3(c.pos)) fail(`scenario.charms[${i}].pos must be [x, y, z]`);
      if ('available' in c && typeof c.available !== 'boolean') fail(`scenario.charms[${i}].available must be boolean`);
      if ('respawn_ticks' in c && !nonNegInt(c.respawn_ticks)) fail(`scenario.charms[${i}].respawn_ticks must be an integer >= 0`);
    });
  }
  if ('time_left_s' in j && !(isNum(j.time_left_s) && j.time_left_s >= 0)) fail('scenario.time_left_s must be a number >= 0');
  return j;
}

export function run(opts) {
  const scenario = opts.scenario ? validateScenario(readJson(opts.scenario, 'scenario'), opts.night) : null;
  const frames = opts.inputs ? validateInputs(readJson(opts.inputs, 'inputs')) : [];
  const sim = createSim({ seed: opts.seed, night: opts.night, scenario });
  const lines = [
    JSON.stringify({ type: 'event', tick: 0, name: 'night_start', data: { night: opts.night } }),
    JSON.stringify(snapshot(sim)),
  ];
  const held = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  let fi = 0;
  let k = 0;
  for (; k < opts.ticks && (sim.state === 'playing'); k++) {
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
