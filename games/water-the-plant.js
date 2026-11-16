/* Water the Plant. The hidden water gauge drains over 30 real minutes and each
   click adds 5 minutes' worth. Watering a full plant wilts it. Full growth
   takes about 8 hours; a plant that wilts back to nothing dies. */
(() => {
  'use strict';
  const E = Engine, S = Sprites, { W } = E;
  const KEY = 'water-the-plant';
  // Rates per second, taken from the original game.
  const DECAY = 100 / (30 * 60);      // water: full to empty in 30 min
  const WATER_PER_CLICK = 100 / 6;    // 5 minutes of a 30-minute gauge
  const GROW = 0.003472;              // growth while watered: 0 to 100 in ~8 h
  const WILT = 0.01;                  // growth lost while dry
  const TICK = 0.2;                   // the original's 200 ms tick, used for the "full" check
  const OVERWATER_PENALTY = 4;
  const GROUND = 124, CX = 80, BASE = GROUND - 14;

  // Save: { growth, water, t } = the state at timestamp t. Everything after is recomputed.
  let save = E.store.get(KEY);
  if (!save || ![save.growth, save.water, save.t].every((v) => typeof v === 'number' && isFinite(v))) save = null;
  const persist = () => E.store.set(KEY, save);
  const erase = () => { save = null; E.store.clear(KEY); };

  // Where the plant is at time `now`: watered and growing first, then dry and wilting.
  function simulate(now) {
    const dt = Math.max(0, (now - save.t) / 1000);
    const wet = Math.min(dt, save.water / DECAY), dry = dt - wet;
    const water = Math.max(0, save.water - DECAY * wet);
    let growth = save.growth + GROW * wet;
    if (growth >= 100) return { growth: 100, water, won: true };
    if (dry > 0) growth -= WILT * dry;
    return { growth: Math.max(0, growth), water, wilted: dry > 0, dead: dry > 0 && growth <= 0 };
  }

  function titleScene(note) {
    return {
      name: 'title',
      draw(g, t) {
        E.title(g, ['WATER THE', 'PLANT'], 14);
        if (E.blink(t)) g.text('PRESS START', W / 2, 58, { align: 'center' });
        if (note) g.text(note, W / 2, 122, { align: 'center' });
      },
      buttons: E.column([
        [save ? 'CONTINUE' : 'START', () => {
          if (!save) { save = { growth: 0, water: 100, t: E.now() }; persist(); }
          E.setScene(gameScene());
        }],
        ['RESET SAVE', () => {
          if (!save) { E.setScene(titleScene('NOTHING TO ERASE')); return; }
          E.setScene(E.confirm('ERASE YOUR SAVE?', () => { erase(); E.setScene(titleScene('SAVE CLEARED')); }, () => E.setScene(titleScene())));
        }],
      ], 76),
    };
  }

  function gameScene() {
    let overwateredUntil = 0, bloomAt = null, drops = [];
    let state = simulate(E.now());
    return {
      name: 'game',
      update(now, t) {
        state = simulate(now);
        if (state.dead) { erase(); E.setScene(loseScene()); return; }
        if (state.won) {
          if (bloomAt === null) bloomAt = t;
          if (t - bloomAt >= 1000) { erase(); E.setScene(winScene()); }
        }
      },
      draw(g, t) {
        E.banner(g, 'WATER THE PLANT', 'CLICK ANYWHERE TO WATER');
        g.rect(0, GROUND, W, 1);
        for (let x = 6; x < W; x += 17) g.rect(x, GROUND + 3, 3, 1);
        S.drawPot(g, CX, GROUND);
        S.drawPlant(g, {
          cx: CX, base: BASE, growth: state.growth, t, still: E.reduceMotion,
          wilted: !state.won && (state.wilted || t < overwateredUntil), bloomed: !!state.won,
        });
        drops = drops.filter((d) => t - d.t < 450);
        const top = BASE - (6 + state.growth * 0.62);
        for (const d of drops) {
          const k = E.reduceMotion ? 0.5 : Math.max(0, (t - d.t) / 450);
          if (t >= d.t) g.sprite(S.DROP, d.x, top - 22 + k * k * 18);
        }
      },
      pointer() {
        const now = E.now(), t = performance.now();
        const cur = simulate(now);
        if (cur.won || cur.dead) return;
        if (cur.water >= 100 - DECAY * TICK) {
          // Overwatering: the plant wilts instead of benefiting.
          save = { growth: Math.max(0, cur.growth - OVERWATER_PENALTY), water: cur.water, t: now };
          overwateredUntil = t + 1200;
        } else {
          save = { growth: cur.growth, water: Math.min(100, cur.water + WATER_PER_CLICK), t: now };
        }
        persist();
        drops.push({ x: CX - 7, t }, { x: CX, t: t + 60 }, { x: CX + 7, t: t + 120 });
      },
      buttons: [E.button('MENU', 2, 130, 34, 13, () => E.setScene(titleScene()))],
    };
  }

  function winScene() {
    return {
      name: 'win',
      draw(g, t) {
        E.title(g, ['FULLY GROWN'], 4);
        g.rect(40, 120, 80, 1);
        S.drawPot(g, CX, 120);
        S.drawPlant(g, { cx: CX, base: 106, growth: 100, bloomed: true, t, still: E.reduceMotion });
      },
      buttons: E.column([['PLAY AGAIN', () => E.setScene(titleScene())]], 126),
    };
  }
  function loseScene() {
    return {
      name: 'lose',
      draw(g) {
        E.title(g, ['GAME OVER'], 14);
        g.para('THE PLANT DRIED UP.', W / 2, 38);
        g.rect(40, 100, 80, 1);
        S.drawPot(g, CX, 100);
        S.drawPlant(g, { cx: CX, base: 86, growth: 30, wilted: true });
      },
      buttons: E.column([['TRY AGAIN', () => E.setScene(titleScene())]], 112),
    };
  }

  if (E.DEBUG) window.__plant = { state: () => (save ? simulate(E.now()) : null) };
  E.mount();
  E.setScene(save ? gameScene() : titleScene());
})();
