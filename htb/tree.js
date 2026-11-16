/* Hack The Box skill tree: canvas renderer, pan/zoom, search, filters and the
   lab panel. Data comes from data/htb.json (written by scripts/htb-sync.mjs)
   and data/htb-extras.json (hand-edited writeup and video links). */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const GOLD = '#c9a45a', GOLD_LIT = '#f6d98a', HTB_GREEN = '#9fef00';
  const CUBE = 'm22.5106 6.4566.0008-.0123a.888.888 0 0 0-.2717-.6384c-.0084-.0084-.018-.0155-.0267-.0235-.0186-.0166-.0371-.0333-.0572-.0484-.0193-.0147-.04-.0276-.0607-.0406-.0096-.006-.0182-.0131-.0281-.0188L12.4576.1266a.891.891 0 0 0-.9223.0043L1.933 5.6744c-.0107.0062-.0203.014-.0307.0205-.0073.0047-.015.008-.0223.0128-.007.0047-.013.0106-.02.0155a.8769.8769 0 0 0-.147.1333l-.0026.003a.8872.8872 0 0 0-.2218.5847l.0009.014c-.0002.0088-.0015.0176-.0015.0264v11.0708c0 .3277.1802.6288.469.7836l9.5986 5.5417c.0076.0044.0158.0075.0236.0117a.8754.8754 0 0 0 .166.0687c.0134.004.0266.0083.0401.0117a.8793.8793 0 0 0 .072.0142c.0117.0019.0232.0045.0349.006a.835.835 0 0 0 .2157 0c.0117-.0015.0232-.0041.0348-.006a.9.9 0 0 0 .072-.0142c.0135-.0034.0267-.0077.04-.0117a.895.895 0 0 0 .0646-.0217.9134.9134 0 0 0 .1015-.047c.0078-.0042.016-.0072.0236-.0117l9.5986-5.5417a.8888.8888 0 0 0 .469-.7836V6.4779c0-.0071-.0012-.0142-.0014-.0213zM5.2543 6.0822l6.5367-3.774a.4182.4182 0 0 1 .4182 0l6.5366 3.774a.4182.4182 0 0 1 0 .7243l-6.5367 3.774a.4182.4182 0 0 1-.4182 0l-6.5366-3.774a.4182.4182 0 0 1 0-.7243zm5.6134 14.3449a.4172.4172 0 0 1-.626.3613L3.718 17.0218a.4173.4173 0 0 1-.2086-.3613V9.1279a.4172.4172 0 0 1 .6258-.3613l6.524 3.7666a.4172.4172 0 0 1 .2086.3614v7.5325zm9.623-3.7666a.4173.4173 0 0 1-.2086.3613l-6.5239 3.7666a.4172.4172 0 0 1-.6259-.3613v-7.5325c0-.149.0796-.2868.2087-.3614l6.5239-3.7666a.4172.4172 0 0 1 .6258.3613v7.5326z';
  const TYPE = { machine: 'Machine', challenge: 'Challenge', sherlock: 'Sherlock', prolab: 'Pro Lab', endgame: 'Endgame', fortress: 'Fortress', sp: 'Starting Point' };
  const DIFFICULTIES = ['Very Easy', 'Easy', 'Medium', 'Hard', 'Insane'];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);
  const make = (tag, props, ...kids) => { const e = Object.assign(document.createElement(tag), props || {}); e.append(...kids.filter((k) => k !== null && k !== undefined && k !== false)); return e; };
  const fmt = (n) => n.toLocaleString('en-US');

  const root = $('tree'), canvas = $('tree-canvas'), ctx = canvas.getContext('2d');
  const tip = $('tip'), panel = $('panel'), panelBody = $('panel-body');
  let W = 0, H = 0, dpr = 1;
  let data = null, nodes = [], edges = [], rootIdx = [], clusters = [], regions = [], extras = {};
  const regionById = {};
  const view = { x: 0, y: 0, k: 1 };
  let fitK = 1, selected = null, hovered = null, raf = 0, anim = null;
  const filter = { done: false, type: '', diff: '', extras: false };
  let dimPath = null, litPath = null, grid = new Map();
  const clusterById = new Map();
  const CELL = 70;
  const glow = {}, icons = new Map();

  /* ---------- helpers ---------- */
  const toScreen = (x, y) => [(x - view.x) * view.k + W / 2, (y - view.y) * view.k + H / 2];
  const toWorld = (sx, sy) => [(sx - W / 2) / view.k + view.x, (sy - H / 2) / view.k + view.y];
  const matches = (n) => (!filter.done || n.completed) && (!filter.type || n.type === filter.type) &&
    (!filter.diff || (n.difficulty || '').toLowerCase() === filter.diff) && (!filter.extras || !!extras[n.id]);
  const filtering = () => filter.done || filter.type || filter.diff || filter.extras;
  const hasExtras = (n) => { const e = extras[n.id]; return !!(e && (e.writeup || e.video)); };
  function labUrl(n) {
    const id = n.id.slice(n.id.indexOf('-') + 1), name = encodeURIComponent(n.name);
    return {
      machine: 'https://app.hackthebox.com/machines/' + name, challenge: 'https://app.hackthebox.com/challenges/' + name,
      sherlock: 'https://app.hackthebox.com/sherlocks/' + name, fortress: 'https://app.hackthebox.com/fortresses/' + id,
      prolab: 'https://app.hackthebox.com/prolabs', endgame: 'https://app.hackthebox.com/endgames', sp: 'https://app.hackthebox.com/starting-point',
    }[n.type] || 'https://app.hackthebox.com/';
  }
  const statusText = (n) => n.completed ? 'Completed' + (n.completedAt ? ' ' + n.completedAt : '') : n.progress > 0 ? `In progress (${n.progress}%)` : 'Not completed';
  const facts = (n) => [TYPE[n.type] || n.type, n.difficulty, n.os || n.category].filter(Boolean).join(' · ');

  function glowSprite(color) {
    if (glow[color]) return glow[color];
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d'), grad = g.createRadialGradient(48, 48, 4, 48, 48, 48);
    grad.addColorStop(0, color + 'cc'); grad.addColorStop(0.35, color + '55'); grad.addColorStop(1, color + '00');
    g.fillStyle = grad; g.fillRect(0, 0, 96, 96);
    return (glow[color] = c);
  }

  /* ---------- static geometry, built once per data load ---------- */
  function build() {
    dimPath = new Path2D(); litPath = new Path2D();
    for (const [a, b, cx, cy] of edges) {
      const p = nodes[a], q = nodes[b], path = p.completed && q.completed ? litPath : dimPath;
      path.moveTo(p.x, p.y); path.quadraticCurveTo(cx, cy, q.x, q.y);
    }
    const med = data.layout.medallion + 9;
    for (const i of rootIdx) {
      const n = nodes[i], d = Math.hypot(n.x, n.y) || 1, path = n.completed ? litPath : dimPath;
      path.moveTo((n.x / d) * med, (n.y / d) * med); path.lineTo(n.x, n.y);
    }
    clusterById.clear();
    for (const c of clusters) clusterById.set(c.id, c);
    grid = new Map();
    nodes.forEach((n, i) => {
      const key = Math.floor(n.x / CELL) + ':' + Math.floor(n.y / CELL);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    });
  }

  function nodeAt(sx, sy) {
    const [wx, wy] = toWorld(sx, sy), reach = Math.max(18, 12 / view.k);
    let best = null, bestD = Infinity;
    const cx = Math.floor(wx / CELL), cy = Math.floor(wy / CELL), span = Math.ceil(reach / CELL);
    for (let gx = cx - span; gx <= cx + span; gx++) for (let gy = cy - span; gy <= cy + span; gy++) {
      for (const i of grid.get(gx + ':' + gy) || []) {
        const n = nodes[i], d = Math.hypot(n.x - wx, n.y - wy);
        if (d <= Math.max(n.r + 2, 11 / view.k) && d < bestD && matches(n)) { best = n; bestD = d; }
      }
    }
    return best;
  }

  /* ---------- drawing ---------- */
  // Adds a node's outline to `path` (or starts a fresh path on the canvas).
  function shape(n, r, path) {
    const p = path || ctx;
    if (!path) ctx.beginPath();
    if (n.type === 'challenge') { p.moveTo(n.x, n.y - r * 1.2); p.lineTo(n.x + r * 1.2, n.y); p.lineTo(n.x, n.y + r * 1.2); p.lineTo(n.x - r * 1.2, n.y); p.closePath(); }
    else if (n.type === 'sherlock') { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; p[i ? 'lineTo' : 'moveTo'](n.x + Math.cos(a) * r * 1.1, n.y + Math.sin(a) * r * 1.1); } p.closePath(); }
    else { p.moveTo(n.x + r, n.y); p.arc(n.x, n.y, r, 0, TAU); }
  }

  function drawNode(n, k) {
    const color = regionById[n.region].color, lit = n.completed, px = n.r * k;
    if (px < 2.4) {                                   // far away: a dot
      const r = Math.max(n.r, 1.25 / k);
      if (lit) { const s = r * 5; ctx.drawImage(glowSprite(color), n.x - s, n.y - s, s * 2, s * 2); }
      ctx.fillStyle = lit ? color : n.progress > 0 ? '#6a7396' : '#333b55';
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, TAU); ctx.fill();
      return;
    }
    const lw = Math.max(1, 1 / k);
    if (lit) { const s = n.r * 3.4; ctx.drawImage(glowSprite(color), n.x - s, n.y - s, s * 2, s * 2); }
    if (n.keystone) {                                 // ornate double frame with tick marks
      ctx.strokeStyle = lit ? GOLD_LIT : '#4d5672'; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 3.5, 0, TAU); ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.moveTo(n.x + Math.cos(a) * (n.r + 3.5), n.y + Math.sin(a) * (n.r + 3.5)); ctx.lineTo(n.x + Math.cos(a) * (n.r + 6.5), n.y + Math.sin(a) * (n.r + 6.5)); }
      ctx.stroke();
    }
    shape(n, n.r);
    if (lit) {
      const g = ctx.createRadialGradient(n.x - n.r * 0.3, n.y - n.r * 0.35, n.r * 0.1, n.x, n.y, n.r * 1.2);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, color); g.addColorStop(1, color);
      ctx.fillStyle = g;
    } else ctx.fillStyle = '#10162a';
    ctx.fill();
    ctx.strokeStyle = lit ? GOLD_LIT : n.progress > 0 ? color : '#49526e'; ctx.lineWidth = lit ? lw * 1.4 : lw; ctx.stroke();
    if (!lit && n.progress > 0) {                     // partial progress arc
      ctx.strokeStyle = color; ctx.lineWidth = lw * 2;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r + (n.keystone ? 0 : 1.5), -Math.PI / 2, -Math.PI / 2 + (n.progress / 100) * TAU); ctx.stroke();
    }
    if (px > 14 && n.icon) drawIcon(n, lit);
    if (px > 3.5 && hasExtras(n)) {                   // has a writeup or video
      const d = n.r * 0.95;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(n.x + d, n.y - d, Math.max(1.3, 2.2 / k), 0, TAU); ctx.fill();
    }
  }

  let loading = 0;
  function drawIcon(n, lit) {
    let img = icons.get(n.icon);
    if (img === undefined) {
      if (loading >= 8) return;                        // limit parallel downloads; the rest load on later frames
      loading++;
      img = new Image(); img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
      img.onload = () => { loading--; requestRender(); };
      img.onerror = () => { loading--; icons.set(n.icon, null); requestRender(); };
      img.src = n.icon; icons.set(n.icon, img);
    }
    if (!img || !img.complete || !img.naturalWidth) return;
    const r = n.r - 1;
    ctx.save(); shape(n, r); ctx.clip();
    ctx.globalAlpha *= lit ? 1 : 0.3;
    ctx.drawImage(img, n.x - r * 1.2, n.y - r * 1.2, r * 2.4, r * 2.4);
    ctx.restore();
  }

  function paintMedallion(ctx, k, glowPx) {
    const R = data.layout.medallion;
    const halo = ctx.createRadialGradient(0, 0, R * 0.4, 0, 0, R * 1.9);
    halo.addColorStop(0, 'rgba(159,239,0,0.20)'); halo.addColorStop(1, 'rgba(159,239,0,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, R * 1.9, 0, TAU); ctx.fill();
    const disc = ctx.createRadialGradient(0, -R * 0.2, R * 0.1, 0, 0, R);
    disc.addColorStop(0, '#16260a'); disc.addColorStop(0.7, '#070d0c'); disc.addColorStop(1, '#03060c');
    ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    // Ornate frame: three rings, tick marks, and a gem per region.
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    ctx.lineWidth = Math.max(0.8, 1 / k);
    ctx.beginPath(); ctx.arc(0, 0, R - 7, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R + 7, 0, TAU); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 72; i++) { const a = (i / 72) * TAU, r1 = R + 7, r2 = R + (i % 6 ? 10 : 14); ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); }
    ctx.stroke();
    for (const region of regions) {
      const [a0, a1] = data.layout.angles[region.id];
      // Quatrefoil socket on each region boundary.
      const bx = Math.cos(a0) * R, by = Math.sin(a0) * R;
      ctx.fillStyle = '#060a16'; ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(1, 1.2 / k);
      for (let i = 0; i < 4; i++) { const a = a0 + Math.PI / 4 + (i * Math.PI) / 2; ctx.beginPath(); ctx.arc(bx + Math.cos(a) * 5.5, by + Math.sin(a) * 5.5, 5, 0, TAU); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(bx, by, 2.6, 0, TAU); ctx.fill();
      // Region gem at the middle of its arc.
      const m = (a0 + a1) / 2, gx = Math.cos(m) * R, gy = Math.sin(m) * R, s = 34;
      ctx.drawImage(glowSprite(region.color), gx - s, gy - s, s * 2, s * 2);
      ctx.fillStyle = region.color; ctx.strokeStyle = GOLD_LIT;
      ctx.beginPath(); ctx.moveTo(gx, gy - 9); ctx.lineTo(gx + 7, gy); ctx.lineTo(gx, gy + 9); ctx.lineTo(gx - 7, gy); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // The HTB cube, large and glowing.
    const size = R * 1.18, s = size / 24;
    ctx.save();
    ctx.translate(-size / 2, -size / 2); ctx.scale(s, s);
    ctx.shadowColor = HTB_GREEN; ctx.shadowBlur = glowPx; ctx.fillStyle = HTB_GREEN;
    const cube = paintMedallion.cube || (paintMedallion.cube = new Path2D(CUBE));
    ctx.fill(cube); ctx.shadowBlur = 0; ctx.fill(cube);
    ctx.restore();
  }

  // The medallion's glow is the most expensive thing on the page, so it is painted once
  // per zoom level into a bitmap and then just copied each frame.
  const medallionCache = new Map();
  function drawMedallion(k) {
    const half = data.layout.medallion * 2, scale = Math.min(4, Math.pow(2, Math.ceil(Math.log2(Math.max(0.25, k * dpr)))));
    let img = medallionCache.get(scale);
    if (!img) {
      img = document.createElement('canvas'); img.width = img.height = Math.ceil(half * 2 * scale);
      const c = img.getContext('2d');
      c.scale(scale, scale); c.translate(half, half);
      paintMedallion(c, scale, 26 * scale);
      medallionCache.set(scale, img);
    }
    ctx.drawImage(img, -half, -half, half * 2, half * 2);
  }

  function draw() {
    raf = 0;
    const k = view.k;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#060a16'; ctx.fillRect(0, 0, W, H);
    const [ox, oy] = toScreen(0, 0), R = data.layout.radius;
    const bg = ctx.createRadialGradient(ox, oy, 0, ox, oy, R * k * 1.15);
    bg.addColorStop(0, '#0f1832'); bg.addColorStop(0.55, '#0a1024'); bg.addColorStop(1, '#060a16');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-view.x, -view.y);
    const hair = Math.max(0.8, 1 / k);

    // Difficulty rings and region dividers.
    ctx.strokeStyle = 'rgba(201,164,90,0.16)'; ctx.lineWidth = hair;
    const gap = 15;
    for (const ring of data.layout.rings) { ctx.beginPath(); ctx.arc(0, 0, ring.inner - gap, 0, TAU); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    ctx.beginPath();
    for (const region of regions) { const a = data.layout.angles[region.id][0]; ctx.moveTo(Math.cos(a) * (data.layout.medallion + 16), Math.sin(a) * (data.layout.medallion + 16)); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); }
    ctx.stroke();

    // Paths.
    const fade = filtering() ? 0.45 : 1;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(201,164,90,${0.34 * fade})`; ctx.lineWidth = Math.max(1.1, 0.8 / k); ctx.stroke(dimPath);
    ctx.strokeStyle = `rgba(246,217,138,${0.25 * fade})`; ctx.lineWidth = Math.max(4.2, 3.4 / k); ctx.stroke(litPath);
    ctx.strokeStyle = `rgba(246,217,138,${fade})`; ctx.lineWidth = Math.max(1.5, 1.2 / k); ctx.stroke(litPath);

    drawMedallion(k);

    // Nodes (only the ones on screen).
    const [x0, y0] = toWorld(-40, -40), [x1, y1] = toWorld(W + 40, H + 40);
    const visible = [];
    const active = filtering();
    // Plain unlit nodes are the vast majority: collect them into two paths (shown / filtered out)
    // and paint each with a single fill and stroke. Everything else is drawn one by one.
    const plain = [new Path2D(), new Path2D()], dots = [new Path2D(), new Path2D()], special = [];
    for (const n of nodes) {
      if (n.x < x0 || n.x > x1 || n.y < y0 || n.y > y1) continue;
      visible.push(n);
      const off = active && !matches(n) ? 1 : 0, px = n.r * k;
      if (n.completed || n.progress > 0 || n.keystone || (px > 14 && n.icon)) { special.push(n); continue; }
      if (px < 2.4) { const r = Math.max(n.r, 1.25 / k); dots[off].moveTo(n.x + r, n.y); dots[off].arc(n.x, n.y, r, 0, TAU); }
      else { shape(n, n.r, plain[off]); if (px > 3.5 && hasExtras(n)) special.push(n); }
    }
    for (const off of [1, 0]) {
      ctx.globalAlpha = off ? 0.13 : 1;
      ctx.fillStyle = '#333b55'; ctx.fill(dots[off]);
      ctx.fillStyle = '#10162a'; ctx.fill(plain[off]);
      ctx.strokeStyle = '#49526e'; ctx.lineWidth = Math.max(1, 1 / k); ctx.stroke(plain[off]);
    }
    for (const n of special) { ctx.globalAlpha = active && !matches(n) ? 0.13 : 1; drawNode(n, k); }
    ctx.globalAlpha = 1;
    for (const [n, color] of [[hovered, 'rgba(255,255,255,0.7)'], [selected, '#ffffff']]) {
      if (!n) continue;
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.4, 1.8 / k);
      ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(n.r + 4, 7 / k), 0, TAU); ctx.stroke();
    }

    // Text is drawn in screen space so it stays crisp.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const mono = '"JetBrains Mono", ui-monospace, monospace', sans = '"Inter Tight", system-ui, sans-serif';
    // Region names around the rim.
    for (const region of regions) {
      const [a0, a1] = data.layout.angles[region.id], m = (a0 + a1) / 2;
      const [sx, sy] = toScreen(Math.cos(m) * (R + 46), Math.sin(m) * (R + 46));
      if (sx < -200 || sx > W + 200 || sy < -40 || sy > H + 40) continue;
      const size = Math.max(11, Math.min(26, 54 * k));
      ctx.font = `600 ${size}px ${sans}`; ctx.fillStyle = region.color;
      ctx.fillText(region.label.toUpperCase(), sx, sy);
      ctx.font = `${Math.max(9, size * 0.5)}px ${mono}`; ctx.fillStyle = 'rgba(217,220,235,0.7)';
      ctx.fillText(`${fmt(region.done)} / ${fmt(region.total)}`, sx, sy + size * 0.95);
    }
    // Difficulty names along the first divider.
    if (k > 0.2) {
      const a = data.layout.angles[regions[0].id][0];
      ctx.font = `10px ${mono}`; ctx.fillStyle = 'rgba(201,164,90,0.75)';
      data.layout.rings.forEach((ring, i) => {
        const next = data.layout.rings[i + 1], outer = next ? next.inner - gap : R, mid = (ring.inner - gap + outer) / 2;
        const [sx, sy] = toScreen(Math.cos(a) * mid, Math.sin(a) * mid);
        const label = (data.bands[i] || '').toUpperCase(), w = ctx.measureText(label).width + 10;
        ctx.fillStyle = '#080d1c'; ctx.fillRect(sx - w / 2, sy - 8, w, 16);
        ctx.fillStyle = 'rgba(201,164,90,0.8)'; ctx.fillText(label, sx, sy);
      });
    }
    // Cluster names, then lab names when close.
    if (k >= 0.8 && k < 2.6) {
      ctx.font = `10px ${mono}`; ctx.fillStyle = 'rgba(160,168,196,0.72)';
      for (const c of clusters) {
        if (!c.label || c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
        const [sx, sy] = toScreen(c.x, c.y - 45);
        ctx.fillText(c.label.toUpperCase(), sx, sy);
      }
    }
    // Lab names: keystones early, everything once zoomed in. Names sit outside the
    // cluster's orbit, pointing away from its center, so neighbors don't collide.
    if (k >= 0.5) {
      ctx.font = `500 11px ${sans}`;
      let count = 0;
      for (const n of visible) {
        if (!(k >= 2.1 || n.keystone) || (active && !matches(n)) || count++ > 240) continue;
        const c = clusterById.get(n.cluster), dx = c ? n.x - c.x : 0, dy = c ? n.y - c.y : 0, d = Math.hypot(dx, dy);
        const name = n.name.length > 24 && n !== selected && n !== hovered ? n.name.slice(0, 22) + '…' : n.name;
        ctx.fillStyle = n.completed ? '#f4e6bf' : 'rgba(150,158,186,0.92)';
        if (d < 20) {                                    // center or inner ring: name goes underneath
          const [sx, sy] = toScreen(n.x, n.y + n.r * 1.2 + (n.keystone ? 7 : 0));
          ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(name, sx, sy + 4);
        } else {
          const ux = dx / d, uy = dy / d, [sx, sy] = toScreen(n.x + ux * n.r * 1.25, n.y + uy * n.r * 1.25);
          ctx.textAlign = ux > 0.35 ? 'left' : ux < -0.35 ? 'right' : 'center';
          ctx.textBaseline = Math.abs(ux) > 0.35 ? 'middle' : uy > 0 ? 'top' : 'bottom';
          ctx.fillText(name, sx + ux * 5, sy + uy * 5);
        }
      }
    }
  }
  function requestRender() { if (!raf && data) raf = requestAnimationFrame(draw); }

  /* ---------- camera ---------- */
  const clampK = (k) => Math.max(fitK * 0.7, Math.min(7, k));
  function clampView() {
    const R = data.layout.radius + 120;
    view.x = Math.max(-R, Math.min(R, view.x)); view.y = Math.max(-R, Math.min(R, view.y));
  }
  function zoomAt(sx, sy, factor) {
    const [wx, wy] = toWorld(sx, sy);
    view.k = clampK(view.k * factor);
    view.x = wx - (sx - W / 2) / view.k; view.y = wy - (sy - H / 2) / view.k;
    clampView(); requestRender();
  }
  function flyTo(x, y, k) {
    k = clampK(k);
    if (reduceMotion) { Object.assign(view, { x, y, k }); requestRender(); return; }
    const from = { ...view }, start = performance.now();
    anim = (t) => {
      const u = Math.min(1, (t - start) / 520), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      // Interpolate zoom on a log scale so it feels even.
      view.k = from.k * Math.pow(k / from.k, e); view.x = from.x + (x - from.x) * e; view.y = from.y + (y - from.y) * e;
      draw();
      if (u < 1 && anim) requestAnimationFrame(anim); else anim = null;
    };
    requestAnimationFrame(anim);
  }
  // Leave room for the UI overlays when fitting.
  function insets() {
    if (W >= 900) return { top: 64, bottom: 16, left: 300, right: 16 };     // controls live in a left sidebar
    return { top: 150, bottom: 64, left: 8, right: 8 };
  }
  // Camera that fits a world rectangle into the part of the screen not covered by UI.
  function fitTarget(x0, y0, x1, y1) {
    const pad = insets(), w = Math.max(1, W - pad.left - pad.right), h = Math.max(1, H - pad.top - pad.bottom);
    const k = Math.min(w / (x1 - x0), h / (y1 - y0));
    return { x: (x0 + x1) / 2 - ((pad.left - pad.right) / 2) / k, y: (y0 + y1) / 2 - ((pad.top - pad.bottom) / 2) / k, k };
  }
  function resetView(animate) {
    const R = data.layout.radius + 70, target = fitTarget(-R, -R, R, R);
    fitK = target.k;
    if (animate) flyTo(target.x, target.y, target.k); else { Object.assign(view, target); requestRender(); }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = root.clientWidth; H = root.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (!data) return;
    const wasFit = Math.abs(view.k - fitK) < 1e-6;
    const R = data.layout.radius + 70;
    fitK = fitTarget(-R, -R, R, R).k;
    if (wasFit) resetView(false); else { view.k = clampK(view.k); requestRender(); }
  }

  /* ---------- pointer, wheel and keyboard input ---------- */
  const pointers = new Map();
  let drag = null, pinch = null;
  const local = (ev) => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };

  canvas.addEventListener('pointerdown', (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    pointers.set(ev.pointerId, local(ev));
    anim = null;
    if (pointers.size === 1) drag = { start: local(ev), moved: false, view: { ...view } };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; if (drag) drag.moved = true; }
    hideTip();
  });
  canvas.addEventListener('pointermove', (ev) => {
    const p = local(ev);
    if (!pointers.has(ev.pointerId)) {                    // plain mouse hover
      if (ev.pointerType !== 'mouse') return;
      const n = nodeAt(p[0], p[1]);
      if (n !== hovered) { hovered = n; requestRender(); }
      canvas.style.cursor = n ? 'pointer' : 'grab';
      if (n) showTip(n, p[0], p[1]); else hideTip();
      return;
    }
    pointers.set(ev.pointerId, p);
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      view.x -= (mid[0] - pinch.mid[0]) / view.k; view.y -= (mid[1] - pinch.mid[1]) / view.k;
      zoomAt(mid[0], mid[1], d / (pinch.d || d));
      pinch = { d, mid };
    } else if (drag && pointers.size === 1) {
      const dx = p[0] - drag.start[0], dy = p[1] - drag.start[1];
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true; canvas.style.cursor = 'grabbing';
      view.x = drag.view.x - dx / view.k; view.y = drag.view.y - dy / view.k;
      clampView(); requestRender();
    }
  });
  const release = (ev) => {
    if (!pointers.has(ev.pointerId)) return;
    const p = local(ev);
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 1) { drag = { start: [...pointers.values()][0], moved: true, view: { ...view } }; return; }
    if (drag && !drag.moved && ev.type === 'pointerup') {
      const n = nodeAt(p[0], p[1]);
      if (n) select(n); else closePanel();
    }
    drag = null; canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => { if (hovered) { hovered = null; requestRender(); } hideTip(); });
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const [sx, sy] = local(ev), delta = ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaY;
    zoomAt(sx, sy, Math.exp(-delta * (ev.ctrlKey ? 0.01 : 0.0016)));
    hideTip();
  }, { passive: false });
  canvas.addEventListener('dblclick', (ev) => { const [sx, sy] = local(ev); zoomAt(sx, sy, 1.8); });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (!$('q-results').hidden) { clearResults(); return; }
      if (!panel.hidden) { closePanel(); return; }
    }
    if (!data || ev.metaKey || ev.ctrlKey || ev.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName) || ev.target.closest('.tree-search, .tree-panel')) return;
    const step = 120 / view.k;
    if (ev.key === '+' || ev.key === '=') zoomAt(W / 2, H / 2, 1.4);
    else if (ev.key === '-' || ev.key === '_') zoomAt(W / 2, H / 2, 1 / 1.4);
    else if (ev.key === '0') resetView(true);
    else if (ev.key === 'ArrowLeft') { view.x -= step; clampView(); requestRender(); }
    else if (ev.key === 'ArrowRight') { view.x += step; clampView(); requestRender(); }
    else if (ev.key === 'ArrowUp') { view.y -= step; clampView(); requestRender(); }
    else if (ev.key === 'ArrowDown') { view.y += step; clampView(); requestRender(); }
    else if (ev.key === '/') { $('q').focus(); }
    else return;
    ev.preventDefault();
  });

  /* ---------- tooltip ---------- */
  function showTip(n, sx, sy) {
    tip.replaceChildren(make('strong', { textContent: n.name }), make('span', { textContent: facts(n) }), make('span', { className: n.completed ? 'done' : '', textContent: statusText(n) }));
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(W - w - 8, sx + 14)) + 'px';
    tip.style.top = (sy + h + 24 > H ? sy - h - 12 : sy + 16) + 'px';
  }
  function hideTip() { tip.hidden = true; }

  /* ---------- lab panel ---------- */
  function youtubeId(url) {
    const m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/.exec(String(url));
    return m ? m[1] : null;
  }
  function select(n, opts = {}) {
    selected = n; hideTip();
    const region = regionById[n.region], extra = extras[n.id] || {};
    const head = make('header', { className: 'panel-head' });
    if (n.icon) { const img = make('img', { className: 'panel-icon', alt: '', referrerPolicy: 'no-referrer' }); img.onerror = () => img.remove(); img.src = n.icon; head.append(img); }
    head.append(make('div', null,
      make('p', { className: 'panel-region mono', textContent: region.label }),
      make('h2', { id: 'panel-title', textContent: n.name })));
    head.querySelector('.panel-region').style.color = region.color;

    const status = make('p', { className: 'panel-status' + (n.completed ? ' done' : ''), textContent: statusText(n) });
    const dl = make('dl', { className: 'panel-facts' });
    const row = (k, v) => { if (v) dl.append(make('div', null, make('dt', { className: 'mono', textContent: k }), make('dd', { textContent: v }))); };
    row('Type', TYPE[n.type] || n.type); row('Difficulty', n.difficulty); row('OS', n.os); row('Category', n.category);
    row('Released', n.release); row('Status', n.retired ? 'Retired' : 'Active');
    const link = make('a', { className: 'panel-link', href: labUrl(n), target: '_blank', rel: 'noopener', textContent: 'Open on Hack The Box ↗' });

    const body = [head, status, dl, link];
    // HTB's rules: solutions for active content can't be published, so writeups and videos only show once a lab is retired.
    const locked = !n.retired;
    if (extra.writeup || extra.video) {
      if (locked) body.push(make('p', { className: 'panel-note', textContent: 'Writeup available after retirement.' }));
      else {
        const id = extra.video ? youtubeId(extra.video) : null;
        if (id) {
          const frame = make('iframe', { className: 'panel-video', title: 'Video walkthrough: ' + n.name, loading: 'lazy', allowFullscreen: true, referrerPolicy: 'strict-origin-when-cross-origin' });
          frame.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen';
          frame.src = 'https://www.youtube-nocookie.com/embed/' + id;
          body.push(make('h3', { textContent: 'Video' }), frame);
        } else if (extra.video && /^https:\/\//.test(extra.video)) {
          body.push(make('h3', { textContent: 'Video' }), make('a', { className: 'panel-link', href: extra.video, target: '_blank', rel: 'noopener', textContent: 'Watch the video ↗' }));
        }
        if (extra.writeup && /^writeups\/[\w./-]+\.md$/.test(extra.writeup) && !extra.writeup.includes('..')) {
          const box = make('div', { className: 'writeup', textContent: 'Loading writeup…' });
          body.push(make('h3', { textContent: 'Writeup' }), box);
          const url = new URL(extra.writeup, document.baseURI).href;
          fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
            .then((md) => { if (selected === n) box.replaceChildren(window.renderMarkdown(md, url)); })
            .catch(() => { box.textContent = 'The writeup could not be loaded.'; });
        }
      }
    } else body.push(make('p', { className: 'panel-note', textContent: 'No writeup or video yet.' }));

    panelBody.replaceChildren(...body);
    panel.hidden = false; root.classList.add('panel-open');
    panel.scrollTop = 0;
    if (opts.focus !== false) $('panel-close').focus({ preventScroll: true });
    try { history.replaceState(null, '', '#' + n.id); } catch (e) { /* file:// or sandboxed */ }
    requestRender();
  }
  function closePanel() {
    if (panel.hidden && !selected) return;
    panel.hidden = true; root.classList.remove('panel-open'); panelBody.replaceChildren(); selected = null;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    requestRender();
  }
  function goTo(n) {
    // Keep the lab clear of the panel: shift the camera so it sits in the free part of the screen.
    const k = Math.max(view.k, 2.6), narrow = W < 700;
    const dx = narrow ? 0 : (W >= 900 ? 50 : 190) / k, dy = narrow ? (H * 0.22) / k : 0;
    flyTo(n.x + dx, n.y + dy, k);
    select(n);
  }
  $('panel-close').addEventListener('click', () => { closePanel(); $('q').focus({ preventScroll: true }); });

  /* ---------- search ---------- */
  const q = $('q'), results = $('q-results');
  function clearResults() { results.hidden = true; results.replaceChildren(); q.setAttribute('aria-expanded', 'false'); }
  function search() {
    const term = q.value.trim().toLowerCase();
    if (!term) { clearResults(); return; }
    const found = nodes.filter((n) => n.name.toLowerCase().includes(term))
      .sort((a, b) => (b.name.toLowerCase().startsWith(term) - a.name.toLowerCase().startsWith(term)) || (b.completed - a.completed) || a.name.localeCompare(b.name)).slice(0, 8);
    results.replaceChildren(...(found.length ? found.map((n) => {
      const b = make('button', { type: 'button', role: 'option' },
        make('span', { className: 'dot' }), make('span', { className: 'name', textContent: n.name }), make('span', { className: 'meta mono', textContent: facts(n) }));
      b.querySelector('.dot').style.background = n.completed ? regionById[n.region].color : 'transparent';
      b.querySelector('.dot').style.borderColor = regionById[n.region].color;
      b.addEventListener('click', () => { clearResults(); goTo(n); });
      return make('li', { role: 'none' }, b);
    }) : [make('li', { className: 'none', textContent: 'No labs match.' })]));
    results.hidden = false; q.setAttribute('aria-expanded', 'true');
  }
  q.addEventListener('input', search);
  q.addEventListener('focus', search);
  q.addEventListener('keydown', (ev) => {
    const first = results.querySelector('button');
    if (ev.key === 'Enter' && first) { ev.preventDefault(); first.click(); }
    else if (ev.key === 'ArrowDown' && first) { ev.preventDefault(); first.focus(); }
  });
  results.addEventListener('keydown', (ev) => {
    const items = [...results.querySelectorAll('button')], i = items.indexOf(document.activeElement);
    if (ev.key === 'ArrowDown') { ev.preventDefault(); (items[i + 1] || items[0]).focus(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); (i <= 0 ? q : items[i - 1]).focus(); }
  });
  document.addEventListener('pointerdown', (ev) => { if (!ev.target.closest('.tree-search')) clearResults(); });

  /* ---------- filters, stats, legend ---------- */
  function setupUi() {
    const types = [...new Set(nodes.map((n) => n.type))].sort((a, b) => Object.keys(TYPE).indexOf(a) - Object.keys(TYPE).indexOf(b));
    $('f-type').append(...types.map((t) => make('option', { value: t, textContent: TYPE[t] || t })));
    const present = new Set(nodes.map((n) => (n.difficulty || '').toLowerCase()));
    $('f-diff').append(...DIFFICULTIES.filter((d) => present.has(d.toLowerCase())).map((d) => make('option', { value: d.toLowerCase(), textContent: d })));
    $('f-extras-wrap').hidden = !nodes.some(hasExtras);
    const apply = () => {
      Object.assign(filter, { done: $('f-done').checked, type: $('f-type').value, diff: $('f-diff').value, extras: $('f-extras').checked });
      const count = nodes.filter(matches).length;
      $('f-count').textContent = filtering() ? `Showing ${fmt(count)} of ${fmt(nodes.length)} labs` : '';
      $('filters-toggle').classList.toggle('on', !!filtering());
      if (selected && !matches(selected)) closePanel();
      requestRender();
    };
    for (const id of ['f-done', 'f-type', 'f-diff', 'f-extras']) $(id).addEventListener('change', apply);
    $('f-clear').addEventListener('click', () => { $('f-done').checked = $('f-extras').checked = false; $('f-type').value = $('f-diff').value = ''; apply(); });
    $('filters-toggle').addEventListener('click', () => {
      const open = $('filters').classList.toggle('open');
      $('filters-toggle').setAttribute('aria-expanded', String(open));
    });

    const done = nodes.filter((n) => n.completed).length;
    const stats = $('stats');
    stats.append(make('span', { className: 'total' }, make('strong', { textContent: fmt(done) }), ` / ${fmt(nodes.length)} completed`));
    for (const region of regions) {
      const mine = nodes.filter((n) => n.region === region.id);
      region.total = mine.length; region.done = mine.filter((n) => n.completed).length;
      const b = make('button', { type: 'button', title: 'Zoom to ' + region.label },
        make('span', { className: 'dot' }), make('span', { textContent: region.label.replace(' Team', '') }), make('span', { className: 'mono', textContent: `${fmt(region.done)}/${fmt(region.total)}` }));
      b.querySelector('.dot').style.background = region.color;
      b.addEventListener('click', () => {
        if (!mine.length) return;
        const xs = mine.map((n) => n.x), ys = mine.map((n) => n.y);
        const t = fitTarget(Math.min(...xs) - 60, Math.min(...ys) - 60, Math.max(...xs) + 60, Math.max(...ys) + 60);
        flyTo(t.x, t.y, t.k);
      });
      stats.append(b);
    }
    if (data.syncedAt) $('synced').textContent = 'Synced ' + new Date(data.syncedAt).toISOString().slice(0, 10);

    $('zoom-in').addEventListener('click', () => zoomAt(W / 2, H / 2, 1.5));
    $('zoom-out').addEventListener('click', () => zoomAt(W / 2, H / 2, 1 / 1.5));
    $('reset').addEventListener('click', () => resetView(true));
    for (const el of $('legend').querySelectorAll('[data-region]')) el.style.background = regionById[el.dataset.region]?.color || '#888';
    if (innerWidth >= 900 && innerHeight >= 940) $('legend').open = true;
  }

  /* ---------- boot ---------- */
  async function boot() {
    root.hidden = false;
    resize();
    const get = (url) => fetch(url, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
    try {
      [data, extras] = await Promise.all([get('data/htb.json'), get('data/htb-extras.json').catch(() => ({}))]);
    } catch (err) { data = null; }
    if (!data || !Array.isArray(data.nodes) || !data.nodes.length || !data.layout) {
      $('tree-empty').hidden = false; root.classList.add('empty'); data = null;
      return;
    }
    nodes = data.nodes; edges = data.edges || []; rootIdx = data.roots || []; clusters = data.clusters || []; regions = data.regions || [];
    for (const r of regions) regionById[r.id] = r;
    extras = extras && typeof extras === 'object' ? extras : {};
    build(); setupUi(); resize(); resetView(false);
    const wanted = decodeURIComponent(location.hash.slice(1));
    const target = wanted && nodes.find((n) => n.id === wanted);
    if (target) { Object.assign(view, { x: target.x, y: target.y, k: clampK(2.6) }); select(target, { focus: false }); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestRender);
    root.classList.add('ready');
    window.__tree = { view, nodes, toScreen, draw, select, goTo };     // handy in the console
  }
  window.addEventListener('resize', resize);
  boot();
})();
