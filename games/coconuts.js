/* Coconuts from the Palm Tree. Eight coconuts each take 25-30 real minutes to
   ripen, stay ripe for 5 minutes, then fall. Click a ripe one to pick it. */
(() => {
  'use strict';
  const E = Engine, S = Sprites, { W } = E;
  const KEY = 'coconuts';
  const MIN = 60 * 1000;
  const RIPEN_MIN = 25 * MIN, RIPEN_MAX = 30 * MIN, RIPE_MS = 5 * MIN;
  const FALL_MS = 1000, CLAIM_MS = 400;        // gap before the next coconut starts growing
  const LIVE_MS = 2000 * E.SPEED;              // events newer than this get an animation
  const REACH = 7;                             // click radius around a coconut, in game pixels

  // Save: { count, slots: [{ s: started at, r: ripens at }] }. Ripe until r + RIPE_MS.
  const fresh = (start) => ({ s: start, r: Math.round(start + RIPEN_MIN + Math.random() * (RIPEN_MAX - RIPEN_MIN)) });
  let save = E.store.get(KEY);
  if (!save || typeof save.count !== 'number' || !Array.isArray(save.slots) || save.slots.length !== S.SLOTS.length ||
      !save.slots.every((x) => x && typeof x.s === 'number' && typeof x.r === 'number')) save = null;
  const persist = () => E.store.set(KEY, save);
  const erase = () => { save = null; E.store.clear(KEY); };

  function titleScene(note) {
    return {
      name: 'title',
      draw(g, t) {
        E.title(g, ['COCONUTS', 'FROM THE', 'PALM TREE'], 6);
        if (E.blink(t)) g.text('PRESS START', W / 2, 64, { align: 'center' });
        if (note) g.text(note, W / 2, 122, { align: 'center' });
      },
      buttons: E.column([
        [save ? 'CONTINUE' : 'START', () => {
          if (!save) { const now = E.now(); save = { count: 0, slots: S.SLOTS.map(() => fresh(now)) }; persist(); }
          E.setScene(gameScene());
        }],
        ['RESET SAVE', () => {
          if (!save) { E.setScene(titleScene('NOTHING TO ERASE')); return; }
          E.setScene(E.confirm('ERASE YOUR SAVE?', () => { erase(); E.setScene(titleScene('SAVE CLEARED')); }, () => E.setScene(titleScene())));
        }],
      ], 78),
    };
  }

  function gameScene() {
    const fx = [];                 // { kind: 'fall' | 'pop', x, y, t }
    const flashed = {};            // slot index -> ripen time already flashed
    let toast = null;              // { text, until }
    let first = true;

    return {
      name: 'game',
      update(now, t) {
        let changed = false, missed = 0;
        save.slots.forEach((slot, i) => {
          let guard = 0;
          // Every ripe window that has closed is a coconut that fell.
          while (now >= slot.r + RIPE_MS) {
            const fellAt = slot.r + RIPE_MS;
            if (now - fellAt < LIVE_MS && !first) fx.push({ kind: 'fall', x: S.SLOTS[i][0], y: S.SLOTS[i][1], t });
            else missed++;
            slot = ++guard > 500 ? fresh(now) : fresh(fellAt + FALL_MS);
            changed = true;
          }
          save.slots[i] = slot;
          if (now >= slot.r && flashed[i] !== slot.r) {
            if (now - slot.r < LIVE_MS && !first) flashed['t' + i] = t;
            flashed[i] = slot.r;
          }
        });
        if (changed) persist();
        if (missed && first) toast = { text: missed + ' FELL WHILE YOU WERE AWAY', until: t + 4000 };
        first = false;
      },
      draw(g, t, now) {
        E.banner(g, ['COCONUTS FROM', 'THE PALM TREE'], 'PICK THE RIPE COCONUTS');
        g.rect(0, S.PALM.ground, W, 1);
        for (let x = 4; x < W; x += 19) g.rect(x, S.PALM.ground + 3, 3, 1);
        S.drawPalm(g, { t, still: E.reduceMotion });

        save.slots.forEach((slot, i) => {
          const [x, y] = S.SLOTS[i];
          const ripe = now >= slot.r;
          const frac = Math.max(0, Math.min(1, (now - slot.s) / (slot.r - slot.s)));
          S.drawCoconut(g, x, y, ripe ? 4 : frac < 0.25 ? 0 : frac < 0.5 ? 1 : frac < 0.8 ? 2 : 3);
          // One-time sparkle in the first second after ripening.
          const flashT = flashed['t' + i];
          if (ripe && flashT !== undefined && t - flashT < 1000) {
            g.sprite(S.POP[E.reduceMotion ? 0 : Math.floor((t - flashT) / 250) % 2], x - 4, y - 4);
          }
        });

        for (let i = fx.length - 1; i >= 0; i--) {
          const f = fx[i], age = t - f.t;
          if (f.kind === 'fall') {
            const floor = S.PALM.ground - 5;
            if (age > FALL_MS) { fx.splice(i, 1); continue; }
            if (age < 600 && !E.reduceMotion) S.drawCoconut(g, f.x, f.y + (floor - f.y) * (age / 600) ** 2, 3);
            else g.sprite(S.SPLAT[age < 800 ? 0 : 1], f.x - 4, floor);
          } else {
            if (age > CLAIM_MS) { fx.splice(i, 1); continue; }
            g.sprite(S.POP[age < 200 ? 0 : 1], f.x - 4, f.y - 4);
            g.text('+1', f.x, f.y - 14 - (E.reduceMotion ? 0 : Math.floor(age / 100)), { align: 'center' });
          }
        }

        g.text('COCONUTS: ' + save.count, W - 2, 134, { align: 'right' });
        if (toast && t < toast.until) {
          g.rect(8, 96, W - 16, 26, 0); g.frame(8, 96, W - 16, 26);
          g.para(toast.text, W / 2, 101, { maxChars: 22 });
        }
      },
      pointer(px, py) {
        const now = E.now(), t = performance.now();
        let best = -1, bestD = REACH * REACH;
        S.SLOTS.forEach(([x, y], i) => {
          const d = (px - x) ** 2 + (py - y) ** 2;
          if (d <= bestD) { best = i; bestD = d; }
        });
        if (best < 0) return;
        const slot = save.slots[best];
        if (now < slot.r || now >= slot.r + RIPE_MS) return;   // not ripe: nothing happens
        save.count++;
        save.slots[best] = fresh(now + CLAIM_MS);
        persist();
        fx.push({ kind: 'pop', x: S.SLOTS[best][0], y: S.SLOTS[best][1], t });
      },
      buttons: [E.button('MENU', 2, 130, 34, 13, () => E.setScene(titleScene()))],
    };
  }

  if (E.DEBUG) window.__coconuts = { save: () => save, now: E.now };
  E.mount();
  E.setScene(save ? gameScene() : titleScene());
})();
