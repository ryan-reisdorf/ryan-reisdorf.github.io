/* 1-bit pixel art shared by the games and the hub previews.
   Sprite rows: '#' = white, 'o' = black, '.' = transparent. */
(() => {
  'use strict';

  /* ---------- the box ---------- */
  const BOX = [
    '################',
    '################',
    '##oooooooooooo##',
    '##o##########o##',
    '##o#oo#######o##',
    '##o#o########o##',
    '##o##########o##',
    '##o##########o##',
    '##o##########o##',
    '##o##########o##',
    '##o##########o##',
    '##o##########o##',
    '##o##########o##',
    '##oooooooooooo##',
    '################',
    '################',
  ];
  // Squash frames for wall hits: same box, 18x14 (hit left/right is tall, top/bottom is wide).
  const BOX_WIDE = [
    '##################',
    '##################',
    '##oooooooooooooo##',
    '##o############o##',
    '##o#oo#########o##',
    '##o#o##########o##',
    '##o############o##',
    '##o############o##',
    '##o############o##',
    '##o############o##',
    '##o############o##',
    '##oooooooooooooo##',
    '##################',
    '##################',
  ];
  const BOX_TALL = [
    '##############',
    '##############',
    '##oooooooooo##',
    '##o########o##',
    '##o#oo#####o##',
    '##o#o######o##',
    '##o########o##',
    '##o########o##',
    '##o########o##',
    '##o########o##',
    '##o########o##',
    '##o########o##',
    '##o########o##',
    '##o########o##',
    '##o########o##',
    '##oooooooooo##',
    '##############',
    '##############',
  ];

  /* ---------- the plant ---------- */
  const POT = [
    '########################',
    '#oooooooooooooooooooooo#',
    '########################',
    '.#oooooooooooooooooooo#.',
    '.#o#oooooooooooooooooo#.',
    '.#o#oooooooooooooooooo#.',
    '..#o#oooooooooooooooo#..',
    '..#oooooooooooooooooo#..',
    '..#oooooooooooooooooo#..',
    '...#oooooooooooooooo#...',
    '...#oooooooooooooooo#...',
    '...#oooooooooooooooo#...',
    '....#oooooooooooooo#....',
    '....################....',
  ];
  // Leaves point right; flip for the left side. Anchored at the bottom-left pixel.
  const LEAF_A = [
    '.....###.',
    '...#####.',
    '..######.',
    '.#####...',
    '####.....',
    '##.......',
  ];
  const LEAF_B = [
    '.........',
    '....####.',
    '..#######',
    '.#######.',
    '#####....',
    '##.......',
  ];
  // Wilted leaf hangs down from its top-left pixel.
  const LEAF_WILT = [
    '##.......',
    '###......',
    '.###.....',
    '.###.....',
    '..###....',
    '..##.....',
    '...#.....',
  ];
  const BUD = [
    '..###..',
    '.#####.',
    '.##o##.',
    '.#####.',
    '..###..',
  ];
  const BLOOM_A = [
    '....###....',
    '...#####...',
    '...#####...',
    '.##.###.##.',
    '####ooo####',
    '####o#o####',
    '####ooo####',
    '.##.###.##.',
    '...#####...',
    '...#####...',
    '....###....',
  ];
  const BLOOM_B = [
    '#....###....#',
    '.#..#####..#.',
    '....#####....',
    '....#####....',
    '.###.ooo.###.',
    '####o###o####',
    '####o###o####',
    '####o###o####',
    '.###.ooo.###.',
    '....#####....',
    '....#####....',
    '.#..#####..#.',
    '#....###....#',
  ];
  const DROP = ['.#.', '.#.', '###', '###', '.#.'];

  /* Draw the plant. growth 0-100; frames come from t (ms). */
  function drawPlant(g, { cx, base, growth, wilted = false, bloomed = false, t = 0, still = false }) {
    const h = Math.round(6 + growth * 0.62);
    const phase = still ? 0 : Math.floor(t / 600) % 4;        // 4-step sway cycle
    const sway = [0, 1, 0, -1][phase];
    const point = (i) => {
      const f = i / h;
      if (wilted) return { x: cx + Math.round(f * f * h * 0.45), y: base - i + Math.round(f * f * f * h * 0.4) };
      return { x: cx + Math.round(sway * f * f * 2), y: base - i };
    };
    for (let i = 0; i <= h; i++) { const p = point(i); g.rect(p.x, p.y, 2, 1); }

    const leaf = (frac, left) => {
      const p = point(Math.round(h * frac));
      if (wilted) g.sprite(LEAF_WILT, left ? p.x - 8 : p.x + 1, p.y, { flip: left });
      else g.sprite(phase % 2 ? LEAF_B : LEAF_A, left ? p.x - 9 : p.x + 2, p.y - 5, { flip: left });
    };
    if (growth > 20) leaf(0.45, true);
    if (growth > 50) leaf(0.75, false);

    if (growth >= 90) {
      const top = point(h);
      if (bloomed) {
        const big = !still && Math.floor(t / 250) % 2 === 1;
        if (big) g.sprite(BLOOM_B, top.x - 6, top.y - 12);
        else g.sprite(BLOOM_A, top.x - 5, top.y - 10);
      } else {
        g.sprite(BUD, top.x - 3, top.y - (wilted ? 2 : 5));
      }
    }
  }
  function drawPot(g, cx, ground) {
    g.sprite(POT, cx - 11, ground - POT.length);
  }

  /* ---------- the palm tree ---------- */
  const TRUNK = [
    '.######.',
    '#oooooo#',
    '#oooooo#',
    '#oooooo#',
  ];
  const TRUNK_BASE = [
    '..########..',
    '.#oooooooo#.',
    '#oooooooooo#',
    '############',
  ];
  // Big frond, arching out to the right from its left edge (anchor: column 0, row 6).
  const FROND = [
    '..............................',
    '..............................',
    '.......#######................',
    '.....############.............',
    '...#####.#.#.######...........',
    '.#####.#.#.#.#.#.####.........',
    '####.#.#.#.#.#.#.#.####.......',
    '#..#.#.#.#.#.#.#.#.#.###......',
    '.....#.#.#.#.#.#.#.#.#.###....',
    '.....#.........#.#.#.#.####...',
    '.................#.#.#.#.###..',
    '...................#.#.#.#.##.',
    '.....................#.#.#.###',
    '.........................#.#.#',
    '...........................#.#',
    '.............................#',
    '.............................#',
  ];
  // Smaller frond reaching up and out (anchor: column 0, bottom row).
  const FROND_UP = [
    '....................',
    '............####....',
    '..........####.###..',
    '.........###.#.#.##.',
    '........##.#.#.#.###',
    '.......###.#.#.#.#.#',
    '......##.#.#.....#.#',
    '.....##..###.......#',
    '.....###....#......#',
    '....##..##..........',
    '...##.#...#.........',
    '...##..##...........',
    '..##.#...#..........',
    '..##..##............',
    '.##.#...#...........',
    '.##..##.............',
    '##.....#............',
    '##..................',
  ];
  const CROWN = [
    '..###..',
    '.#####.',
    '#######',
    '#######',
    '.#####.',
  ];
  // Sway frame: everything right of `from` drops one pixel.
  const shear = (rows, from) => {
    const blank = '.'.repeat(rows[0].length);
    const src = [blank, ...rows, blank];
    return src.slice(1).map((row, r) => row.slice(0, from) + src[r].slice(from)).concat();
  };
  const FROND_2 = shear(FROND, 15);
  const FROND_UP_2 = shear(FROND_UP, 11);

  const COCONUT = [
    ['.#.', '###', '.#.'],
    ['.###.', '#####', '#####', '#####', '.###.'],
    ['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..'],
    ['..#####..', '.#######.', '#########', '#########', '#########', '#########', '#########', '.#######.', '..#####..'],
  ];
  // Ripe looks almost the same as full-grown unripe on purpose: only a small shine.
  const COCONUT_RIPE = ['..#####..', '.#######.', '##oo#####', '##o######', '#########', '#########', '#########', '.#######.', '..#####..'];
  const SPLAT = [
    ['....#....', '.#.....#.', '..##.##..', '.###.###.', '####.####'],
    ['#.......#', '.........', '.#.....#.', '###...###', '###...###'],
  ];
  const POP = [
    ['#...#...#', '.#.....#.', '.........', '.........', '#.......#', '.........', '.........', '.#.....#.', '#...#...#'],
    ['....#....', '.........', '.........', '.........', '#.......#', '.........', '.........', '.........', '....#....'],
  ];

  const PALM = { baseX: 80, ground: 128, crownX: 85, crownY: 56 };
  // Where the 8 coconuts hang, under the crown.
  const SLOTS = [[68, 67], [84, 65], [100, 67], [57, 74], [111, 74], [73, 77], [95, 77], [84, 76]];

  function drawPalm(g, { t = 0, still = false, ox = 0, oy = 0 } = {}) {
    const f = still ? 0 : Math.floor(t / 700) % 2;
    const { baseX, ground, crownX, crownY } = PALM;
    // Trunk: stacked ring segments along a gentle curve.
    const segs = Math.ceil((ground - 4 - crownY) / 4);
    for (let i = 0; i < segs; i++) {
      const k = i / (segs - 1);
      const x = baseX + (crownX - baseX) * k * k;
      g.sprite(TRUNK, ox + Math.round(x) - 4, oy + ground - 8 - i * 4);
    }
    g.sprite(TRUNK_BASE, ox + baseX - 6, oy + ground - 4);
    const big = f ? FROND_2 : FROND, up = f ? FROND_UP_2 : FROND_UP;
    const cx = ox + crownX, cy = oy + crownY;
    g.sprite(up, cx, cy - 21);
    g.sprite(up, cx - 19, cy - 21, { flip: true });
    g.sprite(big, cx, cy - 11);
    g.sprite(big, cx - 29, cy - 11, { flip: true });
    g.sprite(big, cx + 1, cy - 5);
    g.sprite(big, cx - 30, cy - 5, { flip: true });
    g.sprite(CROWN, cx - 3, cy - 3);
  }

  // stage: 0-3 unripe sizes, 4 = ripe.
  function drawCoconut(g, x, y, stage) {
    const rows = stage >= 4 ? COCONUT_RIPE : COCONUT[stage];
    const r = (rows.length - 1) / 2;
    // Black outline so coconuts stay readable against the fronds and each other.
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.sprite(rows, x - r + dx, y - r + dy, { solid: 0 });
    g.sprite(rows, x - r, y - r);
  }

  window.Sprites = {
    BOX, BOX_WIDE, BOX_TALL, DROP, SPLAT, POP, PALM, SLOTS,
    drawPlant, drawPot, drawPalm, drawCoconut,
  };
})();
