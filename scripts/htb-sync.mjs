#!/usr/bin/env node
// Syncs my Hack The Box progress into data/htb.json for the skill tree on htb.html.
//
//   HTB_APP_TOKEN=... node scripts/htb-sync.mjs [--dry-run]
//
// Needs Node 20+. No dependencies. The token is only ever sent to HTB in the
// Authorization header and is never printed. If anything about the API looks
// wrong the script exits non-zero and leaves the last good htb.json alone.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { layout, CONFIG } from './htb-layout.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data', 'htb.json');
const PAGE = path.join(ROOT, 'htb.html');
const BASE = (process.env.HTB_API_BASE || 'https://labs.hackthebox.com/api/v4').replace(/\/$/, '');
const HOST = new URL(BASE).origin;
const USER_ID = process.env.HTB_USER_ID || '4224217';
const TOKEN = (process.env.HTB_APP_TOKEN || '').trim();
const DRY = process.argv.includes('--dry-run');

class ApiError extends Error {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (o, ...keys) => { for (const k of keys) if (o && o[k] !== undefined && o[k] !== null) return o[k]; };
const truthy = (v) => v === true || v === 1 || v === '1';
const day = (v) => { const d = v ? new Date(v) : null; return d && !isNaN(d) ? d.toISOString().slice(0, 10) : null; };
const icon = (p) => (!p || typeof p !== 'string' ? null : /^https?:\/\//.test(p) ? p : HOST + (p.startsWith('/') ? p : '/' + p));
const title = (s) => String(s || '').trim().replace(/\s+/g, ' ');

/* ---------- HTTP ---------- */
let calls = 0;
async function api(route) {
  for (let attempt = 1; ; attempt++) {
    calls++;
    let res;
    try {
      res = await fetch(BASE + route, {
        headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/json', 'User-Agent': 'ryan-reisdorf.github.io htb-sync' },
        signal: AbortSignal.timeout(30000),
      });
    } catch (err) {
      if (attempt < 4) { await sleep(1500 * attempt); continue; }
      throw new ApiError(`${route}: network error (${err.name})`);
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await sleep(Math.min(60, Number(res.headers.get('retry-after')) || 3 * attempt) * 1000);
      continue;
    }
    const text = await res.text();
    if (!res.ok) throw new ApiError(`${route}: HTTP ${res.status} ${text.slice(0, 160).replace(/\s+/g, ' ')}`);
    try { return JSON.parse(text); } catch { throw new ApiError(`${route}: response was not JSON (${text.slice(0, 80).replace(/\s+/g, ' ')})`); }
  }
}

// Follow Laravel-style pagination: { data: [...], meta: { last_page } } or { data, links: { next } }.
async function paged(route) {
  const items = [];
  for (let page = 1; page <= 300; page++) {
    const json = await api(route + (route.includes('?') ? '&' : '?') + 'per_page=100&page=' + page);
    const rows = Array.isArray(json.data) ? json.data : Array.isArray(json.data?.data) ? json.data.data : null;
    if (!rows) throw new ApiError(`${route}: no data array (keys: ${Object.keys(json).join(', ')})`);
    items.push(...rows);
    const meta = json.meta || json.data?.meta || json;
    const last = pick(meta, 'last_page', 'lastPage');
    if (!rows.length || (last !== undefined ? page >= last : !(json.links?.next || meta.next_page_url))) break;
  }
  return items;
}

const tried = [];
// Run several ways of fetching the same thing; fail only if none of them work.
async function anyOf(label, attempts) {
  const results = [], errors = [];
  for (const [name, fn] of attempts) {
    try { const rows = await fn(); results.push(rows); tried.push(`ok   ${label}: ${name} (${rows.length})`); }
    catch (err) { if (!(err instanceof ApiError)) throw err; errors.push(err.message); tried.push(`fail ${label}: ${name} -> ${err.message}`); }
  }
  if (!results.length) throw new ApiError(`${label}: every endpoint failed\n  ` + errors.join('\n  '));
  const rows = results.flat();
  if (rows[0]) console.log(`  ${label} fields: ${Object.keys(rows[0]).join(', ')}`);
  return rows;
}
// Try endpoints in order and use the first one that answers.
async function firstOf(label, attempts) {
  const errors = [];
  for (const [name, fn] of attempts) {
    try {
      const rows = await fn();
      tried.push(`ok   ${label}: ${name} (${rows.length})`);
      if (rows[0]) console.log(`  ${label} fields: ${Object.keys(rows[0]).join(', ')}`);
      return rows;
    } catch (err) { if (!(err instanceof ApiError)) throw err; errors.push(err.message); tried.push(`fail ${label}: ${name} -> ${err.message}`); }
  }
  throw new ApiError(`${label}: every endpoint failed\n  ` + errors.join('\n  '));
}
const optional = async (label, fn, fallback) => {
  try { return await fn(); } catch (err) { if (!(err instanceof ApiError)) throw err; tried.push(`skip ${label} -> ${err.message}`); return fallback; }
};
// Merge rows from several endpoints by id; later fields fill gaps, "owned" is true if any source says so.
function byId(rows, owned) {
  const map = new Map();
  for (const row of rows) {
    if (row?.id === undefined) continue;
    const prev = map.get(row.id);
    map.set(row.id, prev ? { ...row, ...prev, __owned: prev.__owned || owned(row) } : { ...row, __owned: owned(row) });
  }
  return [...map.values()];
}

/* ---------- collectors: one per kind of lab ---------- */
async function machines() {
  const own = (m) => truthy(pick(m, 'authUserInRootOwns', 'auth_user_in_root_owns', 'isCompleted', 'is_completed'));
  const mark = (retired) => (rows) => rows.map((m) => ({ ...m, __retired: retired }));
  const rows = await anyOf('machines', [
    ['active', async () => mark(false)(await paged('/machine/paginated'))],
    ['retired', async () => mark(true)(await paged('/machine/list/retired/paginated'))],
  ]);
  if (!tried.some((t) => t.startsWith('ok   machines: retired'))) throw new ApiError('machines: the retired list failed, refusing a partial catalog');
  return byId(rows, own).map((m) => {
    const user = truthy(pick(m, 'authUserInUserOwns', 'auth_user_in_user_owns'));
    const sp = truthy(m.sp_flag);
    return {
      id: (sp ? 'sp-' : 'machine-') + m.id, type: sp ? 'sp' : 'machine', name: title(m.name), os: m.os || null, category: sp ? 'Starting Point' : null,
      difficulty: pick(m, 'difficultyText', 'difficulty_text') || null,
      retired: m.__retired || truthy(m.retired), release: day(pick(m, 'release', 'release_date')), icon: icon(pick(m, 'avatar', 'avatar_thumb')),
      completed: m.__owned, progress: m.__owned ? 100 : user ? 50 : 0,
    };
  });
}

async function challenges() {
  const cats = new Map();
  const list = await optional('challenge categories', async () => (await api('/challenge/categories/list')).info, []);
  for (const c of list || []) cats.set(c.id, c.name);
  const own = (c) => truthy(pick(c, 'is_owned', 'isOwned', 'authUserSolve', 'auth_user_solve', 'solved', 'isCompleted'));
  const legacy = (route) => async () => { const j = await api(route); const rows = j.challenges || j.data; if (!Array.isArray(rows)) throw new ApiError(route + ': no challenge list'); return rows; };
  const rows = await firstOf('challenges', [
    ['list', () => paged('/challenges')],
    ['legacy lists', async () => [...(await legacy('/challenge/list')()), ...(await legacy('/challenge/list/retired')())]],
  ]);
  return byId(rows, own).map((c) => ({
    id: 'challenge-' + c.id, type: 'challenge', name: title(c.name), os: null,
    category: title(pick(c, 'category_name', 'categoryName') || c.category?.name || cats.get(pick(c, 'challenge_category_id', 'category_id')) || 'Misc'),
    difficulty: typeof c.difficulty === 'string' ? c.difficulty : pick(c, 'difficulty_text', 'difficultyText') || null,
    retired: truthy(c.retired) || /^retired/i.test(String(c.state || '')),
    release: day(pick(c, 'release_date', 'released_at', 'release')), icon: null,
    completed: c.__owned, progress: c.__owned ? 100 : 0,
  }));
}

async function sherlocks() {
  const own = (s) => truthy(pick(s, 'is_owned', 'isOwned', 'solved', 'isCompleted')) || Number(s.progress) >= 100;
  const rows = await firstOf('sherlocks', [
    ['list', () => paged('/sherlocks')],
    ['by state', async () => [...(await paged('/sherlocks?state=active')), ...(await paged('/sherlocks?state=retired'))]],
  ]);
  return byId(rows, own).map((s) => ({
    id: 'sherlock-' + s.id, type: 'sherlock', name: title(s.name), os: null,
    category: title(pick(s, 'category_name', 'categoryName') || s.category?.name || 'General'),
    difficulty: typeof s.difficulty === 'string' ? s.difficulty : pick(s, 'difficulty_text', 'difficultyText') || null,
    retired: truthy(s.retired) || /^retired/i.test(String(s.state || '')),
    release: day(pick(s, 'release_date', 'release_at', 'released_at')), icon: icon(pick(s, 'avatar', 'image')),
    completed: s.__owned, progress: s.__owned ? 100 : Math.max(0, Math.min(99, Math.round(Number(s.progress) || 0))),
  }));
}

const SKILL = { beginner: 'Easy', fundamental: 'Easy', intermediate: 'Medium', advanced: 'Hard', expert: 'Insane' };
async function prolabs() {
  const json = await api('/prolabs');
  const labs = json.data?.labs || json.labs || (Array.isArray(json.data) ? json.data : null);
  if (!Array.isArray(labs)) throw new ApiError('/prolabs: no lab list');
  console.log(`  prolabs fields: ${Object.keys(labs[0] || {}).join(', ')}`);
  tried.push(`ok   prolabs (${labs.length})`);
  return labs.map((l) => {
    const pct = Math.max(0, Math.min(100, Math.round(Number(pick(l, 'ownership', 'progress', 'ownership_percentage')) || 0)));
    return {
      id: 'prolab-' + l.id, type: 'prolab', name: title(l.name), os: null, category: title(l.designated_category) || 'Pro Lab',
      difficulty: SKILL[String(l.skill_level || '').toLowerCase()] || null,
      retired: false, release: day(pick(l, 'release_at', 'release_date')), icon: icon(pick(l, 'avatar_url', 'cover_img_url')),
      completed: pct >= 100, progress: pct,
    };
  });
}

// Fortresses (and Endgames, where the API still has them): the list already carries flag progress.
async function flagLabs(kind, listRoute, category) {
  const json = await api(listRoute);
  const raw = json.data ?? json;
  const list = Array.isArray(raw) ? raw : Object.values(raw || {}).filter((v) => v && typeof v === 'object' && v.id !== undefined);
  if (!list.length) throw new ApiError(listRoute + ': empty list');
  console.log(`  ${kind} fields: ${Object.keys(list[0]).join(', ')}`);
  tried.push(`ok   ${kind} (${list.length})`);
  return list.map((item) => {
    const flags = Number(pick(item, 'number_of_flags', 'endgame_flags_count')) || 0, owned = Number(pick(item, 'owned_flags', 'owned_flags_count')) || 0;
    let pct = flags ? (owned / flags) * 100 : Number(item.ownership) || 0;
    pct = Math.max(0, Math.min(100, pct));
    const done = pct >= 100 || truthy(pick(item, 'has_user_finished', 'completed'));
    return {
      id: `${kind}-${item.id}`, type: kind, name: title(item.name), os: null, category,
      difficulty: null, retired: false, release: day(pick(item, 'release_at', 'created_at')), icon: icon(pick(item, 'image', 'avatar_url', 'cover_image_url')),
      completed: done, progress: done ? 100 : Math.round(Math.min(99, pct)),
    };
  });
}

async function startingPoint() {
  const out = [];
  for (const tier of [1, 2, 3]) {
    const json = await api('/sp/tier/' + tier);
    const rows = json.data?.machines;
    if (!Array.isArray(rows)) throw new ApiError(`/sp/tier/${tier}: no machine list`);
    if (tier === 1) console.log(`  starting point fields: ${Object.keys(rows[0] || {}).join(', ')}`);
    for (const m of rows) {
      const done = truthy(pick(m, 'isCompleted', 'is_completed', 'rootOwn', 'authUserInRootOwns'));
      out.push({
        id: 'sp-' + m.id, type: 'sp', name: title(m.name), os: m.os || null, category: 'Tier ' + (tier - 1),
        difficulty: pick(m, 'difficultyText', 'difficulty_text') || 'Very Easy', retired: true,
        release: day(pick(m, 'release', 'release_date')), icon: icon(m.avatar), completed: done, progress: done ? 100 : 0,
      });
    }
  }
  tried.push(`ok   starting point (${out.length})`);
  return out;
}

/* ---------- cross-check against the numbers on my public profile ---------- */
// HTB's API has no completion dates, so this only compares totals. Never prints account details.
async function profileCounts() {
  const counts = {};
  const basic = await optional('profile', async () => (await api('/user/profile/basic/' + USER_ID)).profile, null);
  if (basic && Number.isFinite(Number(basic.system_owns))) counts.machine = Number(basic.system_owns);
  for (const [type, route] of [['sherlock', 'sherlocks'], ['challenge', 'challenges']]) {
    const solved = await optional('profile ' + route, async () => (await api(`/user/profile/progress/${route}/${USER_ID}`)).profile?.challenge_owns?.solved, undefined);
    if (Number.isFinite(Number(solved))) counts[type] = Number(solved);
  }
  return counts;
}

/* ---------- the no-JS / screen-reader list inside htb.html ---------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TYPE_LABEL = { machine: 'Machine', challenge: 'Challenge', sherlock: 'Sherlock', prolab: 'Pro Lab', endgame: 'Endgame', fortress: 'Fortress', sp: 'Starting Point' };
function listHtml(nodes) {
  const done = nodes.filter((n) => n.completed);
  let html = `\n<p>${done.length} of ${nodes.length} labs completed.</p>\n`;
  for (const region of CONFIG.regions) {
    const mine = done.filter((n) => n.region === region.id).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    html += `<h3>${esc(region.label)} (${mine.length} of ${nodes.filter((n) => n.region === region.id).length})</h3>\n`;
    html += mine.length
      ? '<ul>\n' + mine.map((n) => `  <li>${esc(n.name)}: ${esc([TYPE_LABEL[n.type], n.difficulty, n.os || n.category].filter(Boolean).join(', '))}${n.completedAt ? ', completed ' + n.completedAt : ''}</li>`).join('\n') + '\n</ul>\n'
      : '<p>None yet.</p>\n';
  }
  return html;
}

/* ---------- main ---------- */
async function main() {
  if (!TOKEN) throw new ApiError('HTB_APP_TOKEN is not set. Add it as a repository secret (or export it locally).');
  let prev = null;
  try { prev = JSON.parse(await readFile(DATA, 'utf8')); } catch { /* first run */ }

  console.log('Fetching the HTB catalog...');
  const labs = [
    ...(await machines()), ...(await challenges()), ...(await sherlocks()), ...(await prolabs()),
    ...(await flagLabs('fortress', '/fortresses', 'Fortress')),
    // Endgames and the Starting Point tiers have come and gone from the API: use them when they answer.
    ...(await optional('endgames', () => flagLabs('endgame', '/endgames', 'Endgame'), [])),
    ...(await optional('starting point', startingPoint, [])),
  ].filter((n) => n.name);
  // The same lab can arrive from two endpoints (Starting Point machines): keep the first copy.
  const unique = new Map();
  for (const lab of labs) if (!unique.has(lab.id)) unique.set(lab.id, lab);
  labs.length = 0; labs.push(...unique.values());
  const profile = await profileCounts();
  console.log(tried.map((t) => '  ' + t).join('\n'));

  const prevNodes = new Map((prev?.nodes || []).map((n) => [n.id, n]));
  if (prevNodes.size >= 50 && labs.length < prevNodes.size * 0.7) throw new ApiError(`catalog shrank from ${prevNodes.size} to ${labs.length} labs, refusing to overwrite`);
  const today = new Date().toISOString().slice(0, 10);
  for (const n of labs) {
    const old = prevNodes.get(n.id);
    // HTB doesn't expose completion dates. Keep a stored date; a completion first seen on this run gets today's date.
    n.completedAt = !n.completed ? null : old?.completedAt || (old && !old.completed ? today : null);
  }

  const result = layout(labs, prev);
  result.log.forEach((line) => console.log('! ' + line));
  const counts = {};
  for (const n of result.nodes) { const c = (counts[n.type] ||= [0, 0]); c[1]++; if (n.completed) c[0]++; }
  console.log('Completed / total by type:', Object.entries(counts).map(([t, [d, a]]) => `${t} ${d}/${a}`).join(', '));
  for (const [type, expected] of Object.entries(profile)) {
    const got = counts[type]?.[0] ?? 0;
    console.log(`Cross-check ${type}: profile says ${expected}, catalog has ${got} completed -> ${expected === got ? 'match' : 'MISMATCH'}`);
  }
  console.log(`${result.nodes.length} labs, ${result.clusters.length} clusters, ${result.edges.length} paths, ${calls} API calls.`);

  const body = { version: 1, user: { id: Number(USER_ID) }, layout: result.layout, regions: CONFIG.regions, bands: CONFIG.bands.map((b) => b.label), clusters: result.clusters, nodes: result.nodes, edges: result.edges, roots: result.roots };
  const { syncedAt: _ignored, ...prevBody } = prev || {};
  if (DRY) { console.log('Dry run: not writing files.'); return; }
  if (JSON.stringify(prevBody) === JSON.stringify(body)) console.log('No changes since the last sync.');
  else {
    await mkdir(path.dirname(DATA), { recursive: true });
    await writeFile(DATA, JSON.stringify({ ...body, syncedAt: new Date().toISOString() }) + '\n');
    console.log('Wrote data/htb.json');
  }
  // Keep the plain (no-JS, screen reader) list in htb.html in step with the data.
  const page = await readFile(PAGE, 'utf8').catch(() => null);
  const marks = /(<!-- htb-list:start -->)[\s\S]*?(<!-- htb-list:end -->)/;
  const next = page && marks.test(page) ? page.replace(marks, (_m, a, b) => a + listHtml(result.nodes) + b) : page;
  if (next !== page) { await writeFile(PAGE, next); console.log('Updated the plain list in htb.html'); }
}

main().catch((err) => {
  if (tried.length) console.error(tried.map((t) => '  ' + t).join('\n'));
  console.error('\nHTB sync failed: ' + (err instanceof ApiError ? err.message : err.stack || err));
  console.error('data/htb.json was left unchanged.');
  process.exit(1);
});
