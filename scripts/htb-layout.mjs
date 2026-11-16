// Deterministic layout for the Hack The Box skill tree.
//
// Regions are wedges around the center; distance from the center is difficulty.
// Labs are grouped into small clusters (up to 12 nodes on an orbit). Cluster and
// orbit slots are persisted in data/htb.json, so a new lab takes the next free
// slot and nothing already placed moves. A full re-layout only happens when a
// difficulty band runs out of its built-in headroom.

/* ------------------------------------------------------------------ */
/* Config: edit this to change what goes where.                        */
/* ------------------------------------------------------------------ */
export const CONFIG = {
  // Clockwise from the top.
  regions: [
    { id: 'red', label: 'Red Team', color: '#f0555a' },
    { id: 'purple', label: 'Purple Team', color: '#b07cff' },
    { id: 'blue', label: 'Blue Team', color: '#4aa3ff' },
    { id: 'general', label: 'General', color: '#f2c14e' },
  ],
  // First matching rule wins. `type` and `category` accept a string or a list.
  // Types: machine, challenge, sherlock, prolab, endgame, fortress, sp (Starting Point).
  rules: [
    { type: 'machine', region: 'red' },
    { type: 'sherlock', region: 'blue' },
    { type: 'challenge', category: ['Forensics'], region: 'blue' },
    { type: 'challenge', category: ['Secure Coding'], region: 'purple' },
    { type: 'challenge', category: ['Web', 'Pwn', 'Reversing', 'Crypto', 'Mobile', 'Blockchain', 'GamePwn', 'Hardware'], region: 'red' },
    { type: ['prolab', 'endgame', 'fortress'], region: 'purple' },
    { type: 'sp', region: 'general' },
  ],
  fallbackRegion: 'general',           // OSINT, Misc, AI/ML and anything unmapped
  // Difficulty bands, center outward.
  bands: [
    { label: 'Easy', match: ['very easy', 'easy'] },
    { label: 'Medium', match: ['medium'] },
    { label: 'Hard', match: ['hard'] },
    { label: 'Insane', match: ['insane'] },
  ],
  // Band used when a lab has no difficulty (by type).
  defaultBand: { prolab: 2, endgame: 3, fortress: 2, sp: 0 },
  keystones: ['prolab', 'endgame', 'fortress'],
};

const CAP = 12;            // nodes per cluster
const SPACING = 92;        // distance between cluster centers
const INNER = 215;         // radius where the first band starts
const BAND_GAP = 30;       // empty ring between difficulty bands
const EDGE_PAD = 50;       // margin from a region's boundary lines
const HEADROOM = 1.25;     // spare cluster slots per band before a re-layout is needed
const MIN_SHARE = 0.11;    // smallest wedge a region can get (fraction of the circle)
export const MEDALLION_R = 118;
export const LAYOUT_VERSION = 1;

/* ------------------------------------------------------------------ */

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const asList = (v) => (Array.isArray(v) ? v : [v]);
const round1 = (v) => Math.round(v * 10) / 10;

// FNV-1a: a stable hash so "random" choices are the same on every run.
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) / 4294967296;
}

export function classify(node) {
  let region = CONFIG.fallbackRegion;
  for (const rule of CONFIG.rules) {
    if (!asList(rule.type).includes(node.type)) continue;
    if (rule.category && !asList(rule.category).some((c) => norm(c) === norm(node.category))) continue;
    region = rule.region; break;
  }
  const d = String(node.difficulty ?? '').toLowerCase().trim();
  let band = CONFIG.bands.findIndex((b) => b.match.includes(d));
  if (band < 0) band = CONFIG.defaultBand[node.type] ?? 1;
  const keystone = CONFIG.keystones.includes(node.type);
  let group;
  if (keystone) group = node.name;
  else if (node.type === 'machine') group = /linux/i.test(node.os) ? 'Linux' : /windows/i.test(node.os) ? 'Windows' : 'Other OS';
  else if (node.type === 'sp') group = 'Starting Point';
  else if (node.type === 'sherlock') group = 'Sherlocks: ' + (node.category || 'General');
  else group = node.category || 'Misc';
  return { region, band, group, keystone };
}

/* ---------- band geometry ---------- */

// Cluster positions along one row of a wedge, ordered from the middle outward.
function rowSlots(a0, a1, radius, row) {
  const usable = (a1 - a0) - (2 * EDGE_PAD) / radius;
  if (usable <= 0) return [];
  const count = Math.floor((usable * radius) / SPACING) + 1;
  const step = SPACING / radius, start = (a0 + a1) / 2 - ((count - 1) * step) / 2;
  const slots = [];
  for (let i = 0; i < count; i++) slots.push({ row, i, radius, angle: start + i * step });
  const mid = (count - 1) / 2;
  return slots.sort((p, q) => Math.abs(p.i - mid) - Math.abs(q.i - mid) || p.i - q.i);
}
function bandSlots(angles, ring) {
  const slots = [];
  for (let row = 0; row < ring.rows; row++) slots.push(...rowSlots(angles[0], angles[1], ring.inner + SPACING * (row + 0.5), row));
  return slots;
}

function freshGeometry(counts) {
  // Wedge size follows how many clusters a region holds, with a minimum.
  const totals = CONFIG.regions.map((r) => counts[r.id].reduce((a, b) => a + b, 0));
  const sum = totals.reduce((a, b) => a + b, 0) || 1;
  let shares = totals.map((t) => Math.max(t / sum, MIN_SHARE));
  const shareSum = shares.reduce((a, b) => a + b, 0);
  shares = shares.map((s) => s / shareSum);
  const angles = {};
  let a = -Math.PI / 2 - shares[0] * Math.PI;      // first region is centered on the top
  CONFIG.regions.forEach((r, i) => { angles[r.id] = [a, a + shares[i] * 2 * Math.PI]; a += shares[i] * 2 * Math.PI; });

  const rings = [];
  let inner = INNER;
  for (let b = 0; b < CONFIG.bands.length; b++) {
    const need = {}, have = {};
    for (const r of CONFIG.regions) { const n = counts[r.id][b]; need[r.id] = n ? Math.ceil(n * HEADROOM) + 1 : 0; have[r.id] = 0; }
    let rows = 0;
    do {
      rows++;
      for (const r of CONFIG.regions) have[r.id] += rowSlots(angles[r.id][0], angles[r.id][1], inner + SPACING * (rows - 0.5), rows - 1).length;
    } while (CONFIG.regions.some((r) => have[r.id] < need[r.id]) && rows < 60);
    rings.push({ inner: Math.round(inner), rows });
    inner += rows * SPACING + BAND_GAP;
  }
  return { angles, rings };
}

/* ---------- node positions inside a cluster ---------- */

const RING_ORDER = [0, 6, 3, 9, 1, 7, 4, 10, 2, 8, 5, 11];
// [ring, index]: outer ring has 8 positions, inner ring 4. Order keeps the cluster balanced as it fills.
const DOUBLE_ORDER = [[1, 0], [1, 4], [0, 0], [1, 2], [1, 6], [0, 2], [1, 1], [1, 5], [0, 1], [1, 3], [1, 7], [0, 3]];
function orbit(cluster, slot) {
  const phi = hash(cluster.id + '#rot') * Math.PI * 2;
  if (cluster.keystone) return { ring: 0, rho: 0, angle: 0 };
  if (cluster.pattern === 'double') {
    const [ring, idx] = DOUBLE_ORDER[slot];
    return ring ? { ring: 1, rho: 31, angle: phi + (idx * Math.PI) / 4 } : { ring: 0, rho: 13, angle: phi + Math.PI / 4 + (idx * Math.PI) / 2 };
  }
  return { ring: 1, rho: 30, angle: phi + (RING_ORDER[slot] * Math.PI) / 6 };
}

const NODE_R = { machine: 5.6, challenge: 5, sherlock: 5.6, sp: 4.6, prolab: 16, endgame: 14, fortress: 14 };

/* ------------------------------------------------------------------ */
/* layout(labs, previous htb.json or null) -> { layout, clusters, nodes, edges, roots } */
/* ------------------------------------------------------------------ */
export function layout(labs, prev) {
  const prevOk = prev && prev.layout && prev.layout.version === LAYOUT_VERSION;
  const prevNodes = new Map((prevOk ? prev.nodes : []).map((n) => [n.id, n]));
  const prevClusters = new Map((prevOk ? prev.clusters : []).map((c) => [c.id, c]));
  const log = [];

  // 1. Classify, then keep each known lab in the cluster and orbit slot it already has.
  const clusters = new Map();
  const cluster = (key, n, info) => {
    const id = key + '|' + n;
    if (!clusters.has(id)) clusters.set(id, { id, key, chunk: n, region: info.region, band: info.band, group: info.group, keystone: info.keystone, members: new Array(info.keystone ? 1 : CAP).fill(null) });
    return clusters.get(id);
  };
  const nodes = labs.map((lab) => ({ ...lab, ...classify(lab) }));
  const pending = [];
  for (const n of nodes) {
    n.key = `${n.region}|${n.band}|${n.group}`;
    const p = prevNodes.get(n.id);
    if (p && typeof p.cluster === 'string' && p.cluster.startsWith(n.key + '|') && Number.isInteger(p.slot)) {
      const c = cluster(n.key, Number(p.cluster.slice(n.key.length + 1)), n);
      if (p.slot < c.members.length && !c.members[p.slot]) { c.members[p.slot] = n; n.slot = p.slot; n.cluster = c.id; continue; }
    }
    pending.push(n);
  }
  // 2. New labs: easiest and oldest first, into the first free slot of their group.
  const rank = (n) => (String(n.difficulty).toLowerCase() === 'very easy' ? 0 : 1);
  pending.sort((a, b) => rank(a) - rank(b) || String(a.release || '9').localeCompare(String(b.release || '9')) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  for (const n of pending) {
    for (let chunk = 0; ; chunk++) {
      const c = cluster(n.key, chunk, n);
      const slot = c.members.indexOf(null);
      if (slot >= 0) { c.members[slot] = n; n.slot = slot; n.cluster = c.id; break; }
    }
  }
  const all = [...clusters.values()].filter((c) => c.members.some(Boolean))
    .sort((a, b) => a.region.localeCompare(b.region) || a.band - b.band || a.group.localeCompare(b.group) || a.chunk - b.chunk);

  // 3. Wedges and rings: reuse the stored geometry while everything still fits.
  const counts = {};
  for (const r of CONFIG.regions) counts[r.id] = CONFIG.bands.map(() => 0);
  for (const c of all) counts[c.region][c.band]++;
  let geo = prevOk ? { angles: prev.layout.angles, rings: prev.layout.rings } : null;
  let keepSlots = !!geo;
  const fits = (g) => CONFIG.regions.every((r) => g.angles[r.id] && CONFIG.bands.every((_, b) => g.rings[b] && bandSlots(g.angles[r.id], g.rings[b]).length >= counts[r.id][b]));
  if (!geo || !fits(geo)) {
    if (geo) log.push('A difficulty band is full: recomputing the whole layout (cluster positions will change).');
    geo = freshGeometry(counts); keepSlots = false;
  }

  // 4. Put clusters on band slots: known clusters keep theirs, new ones take the lowest free slot.
  for (const r of CONFIG.regions) for (let b = 0; b < CONFIG.bands.length; b++) {
    const slots = bandSlots(geo.angles[r.id], geo.rings[b]);
    const mine = all.filter((c) => c.region === r.id && c.band === b);
    const taken = new Set();
    for (const c of mine) {
      const p = keepSlots ? prevClusters.get(c.id) : null;
      if (p && Number.isInteger(p.slot) && p.slot < slots.length && !taken.has(p.slot)) { c.slot = p.slot; taken.add(p.slot); }
    }
    let next = 0;
    for (const c of mine) {
      if (c.slot !== undefined) continue;
      while (taken.has(next)) next++;
      c.slot = next; taken.add(next);
    }
    for (const c of mine) {
      const s = slots[c.slot];
      const jr = (hash(c.id + '#jr') - 0.5) * 16, ja = ((hash(c.id + '#ja') - 0.5) * 16) / s.radius;
      c.row = s.row; c.col = s.i;
      c.x = round1(Math.cos(s.angle + ja) * (s.radius + jr)); c.y = round1(Math.sin(s.angle + ja) * (s.radius + jr));
      c.pattern = c.keystone ? 'keystone' : hash(c.id + '#pat') < 0.4 ? 'double' : 'ring';
    }
  }

  // 5. Node positions.
  for (const c of all) c.members.forEach((n, slot) => {
    if (!n) return;
    const o = orbit(c, slot);
    n.x = round1(c.x + Math.cos(o.angle) * o.rho); n.y = round1(c.y + Math.sin(o.angle) * o.rho);
    n.r = NODE_R[n.type] || 5; n.orbit = o;
  });

  // 6. Paths. Each edge is [node a, node b, control x, control y] (a quadratic curve).
  nodes.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const edges = [], seen = new Set();
  const addEdge = (a, b, cx, cy) => {
    const k = a.id < b.id ? a.id + '>' + b.id : b.id + '>' + a.id;
    if (a === b || seen.has(k)) return; seen.add(k);
    edges.push([index.get(a.id), index.get(b.id), Math.round(cx), Math.round(cy)]);
  };
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const nearest = (list, p) => list.reduce((best, n) => (dist(n, p) < dist(best, p) ? n : best));
  const straight = (a, b) => addEdge(a, b, (a.x + b.x) / 2, (a.y + b.y) / 2);

  for (const c of all) {
    const members = c.members.filter(Boolean);
    c.list = members;
    // Arcs along each orbit ring.
    for (const ring of [0, 1]) {
      const on = members.filter((n) => n.orbit.ring === ring && n.orbit.rho > 0).sort((a, b) => a.orbit.angle - b.orbit.angle);
      for (let i = 0; i < on.length && on.length > 1; i++) {
        const a = on[i], b = on[(i + 1) % on.length];
        const gap = (b.orbit.angle - a.orbit.angle + Math.PI * 2) % (Math.PI * 2) || Math.PI * 2;
        if (gap > 1.7 || (on.length === 2 && i === 1)) continue;
        const mid = a.orbit.angle + gap / 2, rho = a.orbit.rho / Math.cos(gap / 2);
        addEdge(a, b, c.x + Math.cos(mid) * rho, c.y + Math.sin(mid) * rho);
      }
    }
    // Spokes from the inner ring, then make sure the cluster is one connected piece.
    const inner = members.filter((n) => n.orbit.ring === 0 && n.orbit.rho > 0), outer = members.filter((n) => n.orbit.ring === 1);
    if (outer.length) for (const n of inner) straight(n, nearest(outer, n));
    const parent = new Map(members.map((n) => [n, n]));
    const find = (n) => { while (parent.get(n) !== n) n = parent.get(n); return n; };
    const local = () => { for (const n of members) parent.set(n, n); for (const [a, b] of edges) { const p = nodes[a], q = nodes[b]; if (p.cluster === c.id && q.cluster === c.id) parent.set(find(p), find(q)); } };
    for (let guard = 0; guard < CAP; guard++) {
      local();
      const root = find(members[0]), rest = members.filter((n) => find(n) !== root);
      if (!rest.length) break;
      const mainGroup = members.filter((n) => find(n) === root);
      let best = null;
      for (const p of rest) { const q = nearest(mainGroup, p); if (!best || dist(p, q) < dist(best[0], best[1])) best = [p, q]; }
      straight(best[0], best[1]);
    }
  }

  // Links between clusters: one inward (toward the center) and one sideways along the row.
  const roots = [];
  const radius = (c) => Math.hypot(c.x, c.y);
  for (const c of all) {
    const inward = all.filter((p) => p.region === c.region && radius(p) < radius(c) - 30);
    if (!inward.length) { roots.push(index.get(nearest(c.list, { x: 0, y: 0 }).id)); }
    else {
      const p = nearest(inward, c);
      const a = nearest(c.list, p), b = nearest(p.list, a);
      const bend = (hash(c.id + '#bend') - 0.5) * 0.36, dx = b.x - a.x, dy = b.y - a.y;
      addEdge(a, b, (a.x + b.x) / 2 - dy * bend, (a.y + b.y) / 2 + dx * bend);
    }
    const side = all.find((p) => p.region === c.region && p.band === c.band && p.row === c.row && p.col === c.col + 1);
    if (side) {
      const a = nearest(c.list, side), b = nearest(side.list, a);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, m = Math.hypot(mx, my) || 1, push = dist(a, b) * 0.13;
      addEdge(a, b, mx + (mx / m) * push, my + (my / m) * push);
    }
  }

  const last = geo.rings[geo.rings.length - 1];
  return {
    log,
    layout: { version: LAYOUT_VERSION, angles: geo.angles, rings: geo.rings, radius: Math.round(last.inner + last.rows * SPACING + 40), medallion: MEDALLION_R, spacing: SPACING },
    clusters: all.map((c) => ({ id: c.id, region: c.region, band: c.band, label: c.keystone ? '' : c.group, slot: c.slot, x: c.x, y: c.y })),
    nodes: nodes.map(({ key, orbit: _o, keystone, group, ...n }) => ({ ...n, group, keystone: keystone || undefined })),
    edges, roots,
  };
}
