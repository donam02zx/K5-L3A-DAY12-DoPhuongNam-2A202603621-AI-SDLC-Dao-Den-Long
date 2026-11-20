// Local leaderboard rules (Ticket-04 §3). Pure functions shared by the browser, the server and tests.
export const LB_MAX = 10;
// 3–12 chars of [A-Za-z0-9_]; Vietnamese letters with diacritics are also accepted (bonus).
const NAME_RE = /^[\p{L}\p{M}0-9_]{3,12}$/u;

export function validName(name) {
  return typeof name === 'string' && NAME_RE.test(name.normalize('NFC'));
}

// ISO 8601 with the local timezone offset, e.g. 2026-11-20T15:04:05+07:00
export function isoWithOffset(date = new Date()) {
  const pad = (n) => String(Math.abs(Math.trunc(n))).padStart(2, '0');
  const off = -date.getTimezoneOffset();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${off >= 0 ? '+' : '-'}${pad(off / 60)}:${pad(off % 60)}`;
}

export function makeEntry({ name, score, nights_won, seed, achieved_at = isoWithOffset() }) {
  const n = String(name ?? '').normalize('NFC');
  if (!validName(n)) throw new Error('name must be 3-12 characters: letters, digits or _');
  if (!Number.isInteger(score) || score < 0) throw new Error('score must be an integer >= 0');
  if (!Number.isInteger(nights_won) || nights_won < 0 || nights_won > 3) throw new Error('nights_won must be 0..3');
  if (!Number.isInteger(seed)) throw new Error('seed must be an integer');
  if (Number.isNaN(Date.parse(achieved_at))) throw new Error('achieved_at must be ISO 8601');
  return { name: n, score, nights_won, achieved_at, seed };
}

// score desc; equal score -> whoever achieved it first ranks higher; stable for identical timestamps.
export function sortEntries(entries) {
  return entries
    .map((e, i) => [e, i])
    .sort(([a, i], [b, j]) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at) || i - j)
    .map(([e]) => e);
}

export function insertEntry(entries, entry) {
  return sortEntries([...entries, makeEntry(entry)]).slice(0, LB_MAX);
}
