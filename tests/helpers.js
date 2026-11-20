import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const CLI = 'src/headless/cli.js';

// Runs the headless CLI exactly like the grader would. Returns { code, stderr, lines, events, snaps, end, raw, ms }.
export function runHeadless({ seed = 1, night = 1, ticks = 60, every = 10, scenario, inputs, extraArgs = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-'));
  const out = join(dir, 'out.jsonl');
  const args = [CLI, '--seed', String(seed), '--night', String(night), '--ticks', String(ticks), '--out', out, '--snapshot-every', String(every)];
  if (scenario !== undefined) {
    const f = join(dir, 'scenario.json');
    writeFileSync(f, typeof scenario === 'string' ? scenario : JSON.stringify(scenario));
    args.push('--scenario', f);
  }
  if (inputs !== undefined) {
    const f = join(dir, 'inputs.json');
    writeFileSync(f, typeof inputs === 'string' ? inputs : JSON.stringify(inputs));
    args.push('--inputs', f);
  }
  args.push(...extraArgs);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const ms = Date.now() - t0;
  let raw = '', lines = [];
  if (r.status === 0) {
    raw = readFileSync(out, 'utf8');
    lines = raw.trim().split('\n').map((l) => JSON.parse(l));
  }
  const snaps = lines.filter((l) => l.type === 'snapshot');
  return {
    code: r.status, stderr: r.stderr, raw, lines, ms, snaps,
    events: lines.filter((l) => l.type === 'event'),
    end: lines.at(-1),
    at: (tick) => snaps.find((s) => s.tick === tick),
  };
}

// Controlled world: no random spawns of any kind, no wind.
export const quiet = (extra = {}) => ({
  random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
  motes: [], shades: [], drifters: [], ...extra,
});
export const ev = (r, name) => r.events.filter((e) => e.name === name);
export const close = (assert, a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b} (±${eps})`);
export const press = (tick, button) => [{ tick, [button]: true }, { tick: tick + 1, [button]: false }];
