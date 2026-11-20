#!/usr/bin/env node
// Game launcher (run_cmd): builds the web game if needed, serves dist/ on http://localhost:5173 and opens the browser.
// Also owns the on-disk leaderboard (GET/POST /api/leaderboard).
//   node scripts/serve.mjs [--port 5173] [--no-open] [--no-build]
//   node scripts/serve.mjs --export-leaderboard out.json      -> {"entries": [...]} in rank order
// Leaderboard file: $DDL_LEADERBOARD or ~/.dao-den-long/leaderboard.json (survives restarts).
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, extname, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { insertEntry, sortEntries, LB_MAX } from '../src/core/leaderboard.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const LB_FILE = process.env.DDL_LEADERBOARD ?? join(homedir(), '.dao-den-long', 'leaderboard.json');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };

export function loadBoard() {
  try { return sortEntries(JSON.parse(readFileSync(LB_FILE, 'utf8')).entries ?? []).slice(0, LB_MAX); } catch { return []; }
}
function saveBoard(entries) {
  mkdirSync(dirname(LB_FILE), { recursive: true });
  writeFileSync(LB_FILE, JSON.stringify({ entries }, null, 2) + '\n');
}

if (args.includes('--export-leaderboard')) {
  const out = opt('--export-leaderboard');
  if (!out) { console.error('error: --export-leaderboard <out.json>'); process.exit(2); }
  writeFileSync(out, JSON.stringify({ entries: loadBoard() }, null, 2) + '\n');
  console.log(`exported ${loadBoard().length} entries to ${out}`);
  process.exit(0);
}

async function ensureBuild() {
  if (args.includes('--no-build')) return;
  let vite;
  try { vite = await import('vite'); } catch { /* release bundle: no vite, use prebuilt dist */ }
  if (vite) await vite.build({ root: ROOT, logLevel: 'warn' });
  if (!existsSync(join(DIST, 'index.html'))) { console.error('error: dist/ missing — run `npm ci` first'); process.exit(1); }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };

export function startServer(port, { onBench } = {}) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/leaderboard') {
      if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ entries: loadBoard() })); return; }
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 1e4) req.destroy(); });
        req.on('end', () => {
          try {
            const entries = insertEntry(loadBoard(), JSON.parse(body));
            saveBoard(entries);
            res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ entries }));
          } catch (e) { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: e.message })); }
        });
        return;
      }
    }
    if (url.pathname.startsWith('/bench/') && req.method === 'POST' && onBench) {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => { res.writeHead(204); res.end(); onBench(url.pathname.slice(7), body ? JSON.parse(body) : null); });
      return;
    }
    const file = resolve(DIST, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(DIST + sep) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(file));
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}

export function openBrowser(url) {
  const [cmd, a] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  spawn(cmd, a, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = +(opt('--port') ?? 5173);
  await ensureBuild();
  await startServer(port);
  const url = `http://localhost:${port}/`;
  console.log(`Đảo Đèn Lồng: ${url}  (leaderboard: ${LB_FILE})  — Ctrl+C to quit`);
  if (!args.includes('--no-open')) openBrowser(url);
}
