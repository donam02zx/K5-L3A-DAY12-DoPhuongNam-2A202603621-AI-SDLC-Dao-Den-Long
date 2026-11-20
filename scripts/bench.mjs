#!/usr/bin/env node
// Ticket-04 §1 benchmark (bench_cmd). Serves the built game, opens a 1280x720 Chrome app window with vsync off,
// runs the standard bench scene (?bench=1), and writes bench.json.
// Usage: node scripts/bench.mjs --seed 42 --duration 30 --out bench.json [--chrome <path>] [--headless]
// Chrome path: --chrome, $CHROME_PATH, or the usual install locations.
import { spawn, execFile } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir, type, release, arch, cpus, totalmem } from 'node:os';
import { join } from 'node:path';
import { startServer } from './serve.mjs';

const T0 = Math.round(performance.timeOrigin); // process start (epoch ms)
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const seed = parseInt(opt('--seed', '42'), 10), duration = parseFloat(opt('--duration', '30')), out = opt('--out', 'bench.json');
if (!Number.isInteger(seed) || !(duration > 0)) { console.error('error: --seed <int> --duration <seconds> --out <file>'); process.exit(2); }

const CANDIDATES = {
  win32: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
};
const chrome = opt('--chrome', process.env.CHROME_PATH) ?? (CANDIDATES[process.platform] ?? CANDIDATES.linux).find(existsSync);
if (!chrome) { console.error('error: Chrome/Chromium not found; pass --chrome <path> or set CHROME_PATH'); process.exit(1); }
if (!existsSync(new URL('../dist/index.html', import.meta.url))) {
  try { await (await import('vite')).build({ root: new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), logLevel: 'warn' }); }
  catch (e) { console.error('error: dist/ missing and build failed — run `npm ci && npm run build`', e.message); process.exit(1); }
}

const profile = mkdtempSync(join(tmpdir(), 'ddl-bench-'));
let firstFrameAt = null, measuring = false, peakMb = null, chromeProc = null, server = null;
const fail = (msg) => { console.error(`error: ${msg}`); try { chromeProc?.kill(); } catch {} process.exit(1); };
setTimeout(() => fail('timed out'), (duration + 90) * 1000).unref();

// RSS of every process of this Chrome instance (identified by its unique profile dir)
function sampleMem() {
  return new Promise((done) => {
    if (process.platform === 'win32') {
      const ps = `(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${profile.split('\\').pop()}*' } | Measure-Object WorkingSetSize -Sum).Sum`;
      execFile('powershell.exe', ['-NoProfile', '-Command', ps], (e, so) => done(e ? null : +so.trim() / 1048576));
    } else {
      execFile('ps', ['-A', '-o', 'rss=,command='], { maxBuffer: 1 << 24 }, (e, so) => {
        if (e) return done(null);
        const kb = so.split('\n').filter((l) => l.includes(profile)).reduce((a, l) => a + (parseInt(l.trim(), 10) || 0), 0);
        done(kb / 1024);
      });
    }
  });
}
async function memLoop() {
  while (measuring) {
    const mb = await sampleMem();
    if (mb != null && mb > 0) peakMb = Math.max(peakMb ?? 0, mb);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

server = await startServer(0, {
  onBench: async (what, data) => {
    if (what === 'first') firstFrameAt = data.epoch;
    else if (what === 'start') { measuring = true; if (!args.includes('--no-mem')) memLoop(); }
    else if (what === 'done') {
      measuring = false;
      const report = {
        contract_version: '1.3',
        avg_fps: data.avg_fps, p1_low_fps: data.p1_low_fps, frame_ms_p95: data.frame_ms_p95, frames: data.frames,
        load_ms: firstFrameAt - T0,
        peak_mem_mb: peakMb == null ? null : +peakMb.toFixed(1),
        vsync_off: true,
        renderer: `three.js r170 WebGLRenderer (WebGL2) · ${data.gpu} · ${data.ua}`,
        os: `${type()} ${release()} ${arch()} · ${cpus()[0]?.model?.trim()} x${cpus().length} · ${(totalmem() / 2 ** 30).toFixed(1)} GB RAM`,
        seed, duration_s: duration, viewport: data.viewport,
        notes: 'Chrome app window 1280x720 with --disable-gpu-vsync --disable-frame-rate-limit; peak_mem_mb = summed RSS/working set of all processes of this Chrome instance, sampled every 1 s while measuring',
      };
      writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify(report, null, 2));
      chromeProc.kill();
      server.close();
      setTimeout(() => process.exit(0), 300);
    }
  },
});
const port = server.address().port;
const url = `http://127.0.0.1:${port}/?bench=1&seed=${seed}&duration=${duration}`;
chromeProc = spawn(chrome, [
  `--app=${url}`, '--window-size=1280,720', '--window-position=40,40', `--user-data-dir=${profile}`,
  '--disable-gpu-vsync', '--disable-frame-rate-limit', '--no-first-run', '--no-default-browser-check',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  ...(args.includes('--headless') ? ['--headless=new'] : []),
], { stdio: 'ignore' });
chromeProc.on('exit', (code) => { if (measuring || firstFrameAt == null) fail(`chrome exited early (${code})`); });
