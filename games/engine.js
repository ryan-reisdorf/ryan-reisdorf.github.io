/* Shared 1-bit engine for the games: canvas + integer scaling, input, loop,
   save, clock and a hand-drawn bitmap font. Pure black and white only. */
(() => {
  'use strict';

  const W = 160, H = 144, WHITE = '#fff', BLACK = '#000';
  const query = new URLSearchParams(location.search);
  // ?debug=1 runs the game clock x1000 (override with &speed=N). Off by default.
  const DEBUG = query.get('debug') === '1';
  const SPEED = DEBUG ? Math.max(1, Number(query.get('speed')) || 1000) : 1;
  const NS = DEBUG ? 'games.debug.' : 'games.';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- save (localStorage with an in-memory fallback) ---------- */
  const mem = new Map();
  const store = {
    get(key) {
      try {
        const raw = localStorage.getItem(NS + key);
        if (raw !== null) return JSON.parse(raw);
      } catch (e) { /* storage blocked or corrupt: fall through */ }
      return mem.has(key) ? mem.get(key) : null;
    },
    set(key, value) {
      mem.set(key, value);
      try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch (e) { /* keep in memory */ }
    },
    clear(key) {
      mem.delete(key);
      try { localStorage.removeItem(NS + key); } catch (e) { /* nothing to clear */ }
    },
  };

  /* ---------- clock: real time, or accelerated in debug ---------- */
  const realStart = Date.now();
  let virtStart = realStart;
  if (DEBUG) {
    const saved = store.get('clock');
    if (typeof saved === 'number' && saved > virtStart) virtStart = saved;
  }
  const now = () => (SPEED === 1 ? Date.now() : Math.round(virtStart + (Date.now() - realStart) * SPEED));

  /* ---------- bitmap font, 5x7, uppercase ---------- */
  const GLYPHS = {
    A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.',
    C: '.###./#...#/#..../#..../#..../#...#/.###.', D: '####./#...#/#...#/#...#/#...#/#...#/####.',
    E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
    G: '.###./#...#/#..../#.###/#...#/#...#/.###.', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
    I: '.###./..#../..#../..#../..#../..#../.###.', J: '..###/...#./...#./...#./...#./#..#./.##..',
    K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
    M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
    O: '.###./#...#/#...#/#...#/#...#/#...#/.###.', P: '####./#...#/#...#/####./#..../#..../#....',
    Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
    S: '.####/#..../#..../.###./....#/....#/####.', T: '#####/..#../..#../..#../..#../..#../..#..',
    U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.', V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
    W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    Y: '#...#/#...#/.#.#./..#../..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#..../#####',
    0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.', 1: '..#../.##../..#../..#../..#../..#../.###.',
    2: '.###./#...#/....#/...#./..#../.#.../#####', 3: '####./....#/....#/.###./....#/....#/####.',
    4: '...#./..##./.#.#./#..#./#####/...#./...#.', 5: '#####/#..../####./....#/....#/#...#/.###.',
    6: '.###./#..../#..../####./#...#/#...#/.###.', 7: '#####/....#/...#./..#../.#.../.#.../.#...',
    8: '.###./#...#/#...#/.###./#...#/#...#/.###.', 9: '.###./#...#/#...#/.####/....#/....#/.###.',
    ' ': '...../...../...../...../...../...../.....', '.': '...../...../...../...../...../.##../.##..',
    ',': '...../...../...../...../.##../..#../.#...', '!': '..#../..#../..#../..#../..#../...../..#..',
    '?': '.###./#...#/....#/...#./..#../...../..#..', "'": '..#../..#../.#.../...../...../...../.....',
    '"': '.#.#./.#.#./...../...../...../...../.....', '-': '...../...../...../.###./...../...../.....',
    ':': '...../.##../.##../...../.##../.##../.....', '/': '....#/....#/...#./..#../.#.../#..../#....',
    '(': '...#./..#../.#.../.#.../.#.../..#../...#.', ')': '.#.../..#../...#./...#./...#./..#../.#...',
    '+': '...../..#../..#../#####/..#../..#../.....', '%': '##..#/##..#/...#./..#../.#.../#..##/#..##',
    '<': '...../..#../.#.../#####/.#.../..#../.....', '>': '...../..#../...#./#####/...#./..#../.....',
    '=': '...../...../#####/...../#####/...../.....',
  };
  const FONT = {};
  for (const ch in GLYPHS) FONT[ch] = GLYPHS[ch].split('/');
  const UNKNOWN = '#####/#...#/#...#/#...#/#...#/#...#/#####'.split('/');
  const normalize = (s) => String(s).toUpperCase().replace(/[—–]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  const textWidth = (s, scale = 1) => (String(s).length * 6 - 1) * scale;
  function wrap(str, maxChars) {
    const lines = [];
    let line = '';
    for (const word of normalize(str).split(/\s+/)) {
      if (line && (line + ' ' + word).length > maxChars) { lines.push(line); line = word; }
      else line = line ? line + ' ' + word : word;
    }
    if (line) lines.push(line);
    return lines;
  }

  /* ---------- drawing surface: only fills whole pixels in #000 / #fff ---------- */
  function makeGfx(canvas) {
    const ctx = canvas.getContext('2d');
    const col = (c) => { ctx.fillStyle = c ? WHITE : BLACK; };
    const g = {
      w: canvas.width, h: canvas.height, canvas,
      clear() { col(0); ctx.fillRect(0, 0, g.w, g.h); },
      rect(x, y, w, h, c = 1) { col(c); ctx.fillRect(Math.round(x), Math.round(y), w, h); },
      px(x, y, c = 1) { g.rect(x, y, 1, 1, c); },
      frame(x, y, w, h, c = 1) {
        g.rect(x, y, w, 1, c); g.rect(x, y + h - 1, w, 1, c);
        g.rect(x, y, 1, h, c); g.rect(x + w - 1, y, 1, h, c);
      },
      // Sprite rows: '#' = white, 'o' = black, '.' = transparent.
      // solid: 0 or 1 paints every pixel of the sprite in that one color (used for outlines).
      sprite(rows, x, y, { flip = false, invert = false, solid = null } = {}) {
        x = Math.round(x); y = Math.round(y);
        for (let r = 0; r < rows.length; r++) {
          const row = rows[r], n = row.length;
          for (let c = 0; c < n; c++) {
            const ch = row[flip ? n - 1 - c : c];
            if (ch === '.') continue;
            col(solid !== null ? solid : (ch === '#') !== invert);
            ctx.fillRect(x + c, y + r, 1, 1);
          }
        }
      },
      text(str, x, y, { scale = 1, align = 'left', c = 1 } = {}) {
        const s = normalize(str);
        x = Math.round(x); y = Math.round(y);
        if (align === 'center') x -= Math.floor(textWidth(s, scale) / 2);
        else if (align === 'right') x -= textWidth(s, scale);
        col(c);
        for (let i = 0; i < s.length; i++) {
          const glyph = FONT[s[i]] || UNKNOWN;
          for (let r = 0; r < 7; r++) for (let k = 0; k < 5; k++) {
            if (glyph[r][k] === '#') ctx.fillRect(x + (i * 6 + k) * scale, y + r * scale, scale, scale);
          }
        }
      },
      // Centered, wrapped paragraph. Returns the y below the last line.
      para(str, cx, y, { maxChars = 26, lineH = 9, c = 1 } = {}) {
        for (const line of wrap(str, maxChars)) { g.text(line, cx, y, { align: 'center', c }); y += lineH; }
        return y;
      },
    };
    return g;
  }

  /* Blit a low-res surface to a visible canvas at an integer number of device
     pixels per game pixel, with optional baked-in black CRT scanlines. */
  function present(src, dst, cssW, cssH, scanlines) {
    const dpr = window.devicePixelRatio || 1;
    const k = Math.max(1, Math.floor(Math.min((cssW * dpr) / src.width, (cssH * dpr) / src.height)));
    const bw = src.width * k, bh = src.height * k;
    if (dst.width !== bw || dst.height !== bh) {
      dst.width = bw; dst.height = bh;
      dst.style.width = bw / dpr + 'px'; dst.style.height = bh / dpr + 'px';
    }
    const d = dst.getContext('2d');
    d.imageSmoothingEnabled = false;
    d.drawImage(src, 0, 0, bw, bh);
    if (scanlines && k >= 3) {
      d.fillStyle = BLACK;
      const t = k >= 8 ? 2 : 1;
      for (let y = 0; y < src.height; y++) d.fillRect(0, y * k + k - t, bw, t);
    }
  }

  /* ---------- scenes, buttons, input, loop ---------- */
  const buffer = document.createElement('canvas');
  buffer.width = W; buffer.height = H;
  const gfx = makeGfx(buffer);
  let screen = null, stage = null, scene = null, raf = 0;
  let selected = -1, hovered = -1;
  const ripples = [];

  const buttons = () => {
    if (!scene || !scene.buttons) return [];
    return typeof scene.buttons === 'function' ? scene.buttons() : scene.buttons;
  };
  const button = (label, x, y, w, h, onPress) => ({ label, x, y, w, h, onPress });
  // Centered column of buttons from [label, action] pairs.
  function column(items, y, { w = 96, h = 15, gap = 4 } = {}) {
    return items.map(([label, onPress], i) => button(label, Math.round((W - w) / 2), y + i * (h + gap), w, h, onPress));
  }
  const hit = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;

  function setScene(next) {
    scene = next; selected = -1; hovered = -1;
  }

  function toGame(ev) {
    const r = screen.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
  }

  function onPointerDown(ev) {
    if (!scene) return;
    ev.preventDefault();
    const p = toGame(ev);
    if (!reduceMotion) ripples.push({ x: Math.round(p.x), y: Math.round(p.y), t: performance.now() });
    const list = buttons();
    for (let i = 0; i < list.length; i++) {
      if (hit(list[i], p.x, p.y)) { list[i].onPress(); return; }
    }
    if (scene.pointer) scene.pointer(p.x, p.y);
  }

  function onPointerMove(ev) {
    if (!scene || ev.pointerType === 'touch') return;
    const p = toGame(ev);
    hovered = buttons().findIndex((b) => hit(b, p.x, p.y));
    const hot = hovered >= 0 || (scene.hot && scene.hot(p.x, p.y));
    screen.style.cursor = hot ? 'pointer' : 'default';
  }

  function onKey(ev) {
    if (!scene || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const list = buttons();
    const k = ev.key;
    if (k === 'ArrowDown' || k === 'ArrowRight') {
      if (list.length) selected = (selected + 1) % list.length;
    } else if (k === 'ArrowUp' || k === 'ArrowLeft') {
      if (list.length) selected = (selected - 1 + list.length) % list.length;
    } else if (k === 'Enter' || k === ' ') {
      if (list.length) list[Math.max(0, selected)].onPress();
      else if (scene.pointer) scene.pointer(W / 2, H / 2);
    } else return;
    ev.preventDefault(); // keep arrows and space from scrolling the page
  }

  function drawButtons() {
    const list = buttons();
    for (let i = 0; i < list.length; i++) {
      const b = list[i], on = i === selected || i === hovered;
      gfx.rect(b.x, b.y, b.w, b.h, on ? 1 : 0);
      gfx.frame(b.x, b.y, b.w, b.h, 1);
      gfx.text(b.label, b.x + b.w / 2, b.y + Math.floor((b.h - 7) / 2), { align: 'center', c: on ? 0 : 1 });
    }
  }

  function drawRipples(t) {
    for (let i = ripples.length - 1; i >= 0; i--) {
      const age = t - ripples[i].t;
      if (age > 300) { ripples.splice(i, 1); continue; }
      const r = 2 + Math.floor(age / 100) * 2;
      gfx.frame(ripples[i].x - r, ripples[i].y - r, r * 2 + 1, r * 2 + 1, 1);
    }
  }

  function tick(t) {
    if (!scene) return;
    if (scene.update) scene.update(now(), t);
    gfx.clear();
    scene.draw(gfx, t, now());
    drawButtons();
    drawRipples(t);
    present(buffer, screen, stage.clientWidth, stage.clientHeight, true);
  }

  function frame(t) {
    raf = 0;
    tick(t);
    if (!document.hidden) raf = requestAnimationFrame(frame);
  }

  function mount() {
    screen = document.getElementById('screen');
    stage = document.getElementById('stage');
    screen.addEventListener('pointerdown', onPointerDown);
    screen.addEventListener('pointermove', onPointerMove);
    window.addEventListener('keydown', onKey);

    // Pixel-text back link.
    const back = document.querySelector('#back canvas');
    if (back) {
      const label = '< BACK' + (DEBUG ? '   DEBUG X' + SPEED : '');
      back.width = textWidth(label); back.height = 7;
      back.style.width = back.width * 2 + 'px'; back.style.height = '14px';
      const bg = makeGfx(back);
      bg.clear(); bg.text(label, 0, 0);
    }

    // Animations stop while the tab is hidden; a slow heartbeat keeps the
    // real-time game clocks (and notifications) moving.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !raf) raf = requestAnimationFrame(frame);
    });
    setInterval(() => {
      if (document.hidden && scene && scene.update) scene.update(now(), performance.now());
      if (DEBUG) store.set('clock', now());
    }, 1000);
    window.addEventListener('pagehide', () => { if (DEBUG) store.set('clock', now()); });
    raf = requestAnimationFrame(frame);
  }

  /* ---------- small shared UI pieces ---------- */
  const blink = (t, ms = 500) => reduceMotion || Math.floor(t / ms) % 2 === 0;
  function title(g, lines, y) {
    for (const line of lines) { g.text(line, W / 2, y, { scale: 2, align: 'center' }); y += 18; }
    return y;
  }
  function banner(g, lines, sub) {
    let y = 4;
    for (const line of [].concat(lines)) { g.text(line, W / 2, y, { align: 'center' }); y += 9; }
    g.rect(W / 2 - 20, y + 1, 40, 1);
    if (sub) g.text(sub, W / 2, y + 5, { align: 'center' });
  }
  // Yes/no confirmation scene.
  function confirm(question, onYes, onNo) {
    return {
      name: 'confirm',
      draw(g) { g.para(question, W / 2, 40); },
      buttons: column([['YES', onYes], ['NO', onNo]], 70),
    };
  }

  window.Engine = {
    W, H, DEBUG, SPEED, reduceMotion,
    now, store, mount, setScene, button, column, blink, title, banner, confirm,
    makeGfx, present, textWidth, wrap,
    get scene() { return scene; },
  };
})();
