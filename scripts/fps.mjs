#!/usr/bin/env node
// Measures average FPS of the built game at 1280x720 in real (GPU) Chrome via the DevTools protocol.
// Usage: npm run build && npx vite preview --port 4173 &  node scripts/fps.mjs [chromePath] [seconds]
// Needs Node >= 22 (global WebSocket).
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = process.argv[2] ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome');
const seconds = +(process.argv[3] ?? 12);
const port = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, '--window-size=1280,720', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ddl-fps-'))}`, '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d); });
  return {
    send: (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }),
    close: () => ws.close(),
  };
}

try {
  let targets;
  for (let i = 0; i < 50 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(200); } }
  const page = targets.find((t) => t.type === 'page');
  const c = await cdp(page.webSocketDebuggerUrl);
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const results = {};
  for (const night of [1, 2, 3]) {
    await c.send('Page.navigate', { url: `http://localhost:4173/?auto=1&night=${night}&seed=1&fps=1` });
    await sleep(seconds * 1000);
    const r = await c.send('Runtime.evaluate', { expression: 'JSON.stringify({fps: window.__ddl.fps(), gl: (()=>{const g=document.querySelector("canvas").getContext("webgl2");const e=g.getExtension("WEBGL_debug_renderer_info");return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):"?"})(), w: innerWidth, h: innerHeight})', returnByValue: true });
    const v = JSON.parse(r.result.result.value);
    const s = v.fps.slice(2); // skip warm-up seconds
    results[night] = { avg_fps: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1), min_fps: +Math.min(...s).toFixed(1), samples: s.length, viewport: `${v.w}x${v.h}`, renderer: v.gl };
  }
  console.log(JSON.stringify(results, null, 2));
  c.close();
} finally {
  proc.kill();
}
