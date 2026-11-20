#!/usr/bin/env node
// UI smoke test (Ticket-04 §3/§4) in real Chrome via DevTools: key remap (duplicate detection, reset, persistence),
// large text / reduce motion toggles, min font size, leaderboard save -> board screen -> on-disk export.
// Usage: npm run build && node scripts/ui-smoke.mjs [chromePath]   (writes docs/proof/phase-4/ui-smoke.json)
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const lbFile = join(mkdtempSync(join(tmpdir(), 'ddl-lb-')), 'leaderboard.json');
process.env.DDL_LEADERBOARD = lbFile;
const { startServer } = await import('./serve.mjs');
const chrome = process.argv[2] ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=9334', '--window-size=1280,720', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ddl-ui-'))}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); };

try {
  let targets;
  for (let i = 0; i < 50 && !targets; i++) { try { targets = await (await fetch('http://127.0.0.1:9334/json')).json(); } catch { await sleep(200); } }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); pend.get(d.id)?.(d); });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true })).result.result.value;
  const key = (code) => ev(`dispatchEvent(new KeyboardEvent('keydown', { code: '${code}' })); dispatchEvent(new KeyboardEvent('keyup', { code: '${code}' }));`);
  const click = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: base });
  await sleep(2500);

  // min font size on visible UI text (menu)
  const minFont = await ev(`return Math.min(...[...document.querySelectorAll('#menu *')].filter(e => e.textContent.trim() && e.offsetParent).map(e => parseFloat(getComputedStyle(e).fontSize)))`);
  check('min UI font size >= 18px at 1280x720', minFont >= 18, minFont);

  // key remap: duplicate is refused, then a free key works, reset restores defaults, all persisted
  await click('[data-act="settings"]');
  await click('[data-action="jump"]');
  await key('KeyW');
  const clashMsg = await ev(`return document.getElementById('keys-msg').textContent`);
  check('duplicate key is detected and reported', /đang dùng/.test(clashMsg), clashMsg);
  await key('KeyJ');
  const jumpKey = await ev(`return JSON.parse(localStorage.getItem('ddl-settings')).keys.jump`);
  check('rebinding saves a new key', jumpKey === 'KeyJ', jumpKey);
  await click('#set-large'); await click('#set-rm');
  await send('Page.reload'); await sleep(2500);
  const persisted = await ev(`const s = JSON.parse(localStorage.getItem('ddl-settings')); return { jump: s.keys.jump, large: s.large, reduceMotion: s.reduceMotion, bodyLarge: document.body.classList.contains('large') }`);
  check('settings persist across reload (keys, large text, reduce motion)', persisted.jump === 'KeyJ' && persisted.large && persisted.reduceMotion && persisted.bodyLarge, persisted);
  await click('[data-act="settings"]');
  await click('[data-act="keys-reset"]');
  const reset = await ev(`return JSON.parse(localStorage.getItem('ddl-settings')).keys.jump`);
  check('"Khôi phục mặc định" restores defaults', reset === 'Space', reset);
  const actions = await ev(`return [...document.querySelectorAll('[data-act="rebind"]')].map(b => b.dataset.action)`);
  check('every action is remappable', ['up', 'down', 'left', 'right', 'jump', 'dash', 'interact', 'pulse', 'pause'].every((a) => actions.includes(a)), actions);

  // leaderboard: POST via the launcher API (as the result screen does), board screen, export command
  const post = await ev(`const r = await fetch('/api/leaderboard', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ name: 'Mây_01', score: 1234, nights_won: 2, seed: 99, achieved_at: '2026-11-20T16:00:00+07:00' }) }); return r.status`);
  const bad = await ev(`const r = await fetch('/api/leaderboard', { method: 'POST', body: JSON.stringify({ name: 'x!', score: 1, nights_won: 0, seed: 1 }) }); return r.status`);
  check('leaderboard API accepts a valid entry and rejects a bad name', post === 200 && bad === 400, { post, bad });
  await click('[data-act="back"]'); await click('[data-act="board"]'); await sleep(500);
  const boardText = await ev(`return document.getElementById('board-rows').textContent`);
  check('leaderboard screen lists the saved entry', /Mây_01/.test(boardText) && /1234/.test(boardText), boardText.slice(0, 80));
  const out = join(tmpdir(), 'ddl-export.json');
  const ex = spawnSync(process.execPath, ['scripts/serve.mjs', '--export-leaderboard', out], { encoding: 'utf8', env: { ...process.env, DDL_LEADERBOARD: lbFile } });
  const exported = JSON.parse(readFileSync(out, 'utf8'));
  check('--export-leaderboard reads the on-disk board', ex.status === 0 && exported.entries[0]?.name === 'Mây_01', exported);
  ws.close();
} finally {
  proc.kill();
  server.close();
}
const ok = checks.every((c) => c.ok);
writeFileSync('docs/proof/phase-4/ui-smoke.json', JSON.stringify({ ok, checks }, null, 2) + '\n');
process.exit(ok ? 0 : 1);
