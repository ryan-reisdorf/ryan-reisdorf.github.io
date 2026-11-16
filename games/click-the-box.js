/* Click the Box. Level 1: a box. Level 2: a bouncing box. Level 3: the box
   shows up once, at a random real-world time, for five seconds. */
(() => {
  'use strict';
  const E = Engine, S = Sprites, { W } = E;
  const KEY = 'click-the-box';
  const SIZE = 16, SHOW_MS = 5000;
  const MIN = 60 * 1000, HOUR = 60 * MIN, YEAR = 365 * 24 * HOUR;
  const AREA = { x0: 2, y0: 26, x1: W - 2 - SIZE, y1: 116 - SIZE };  // where the box may be
  const DIFFICULTIES = ['easy', 'normal', 'hard'];

  // Save: { difficulty, level, target (ms timestamp, level 3), notify }
  let save = E.store.get(KEY);
  if (!save || !DIFFICULTIES.includes(save.difficulty) || ![1, 2, 3].includes(save.level) ||
      (save.level === 3 && typeof save.target !== 'number')) save = null;
  const persist = () => E.store.set(KEY, save);
  const erase = () => { save = null; E.store.clear(KEY); };

  // Same ranges as the original: easy = later today, normal = 5 min to a year, hard = 1 h to 100 years.
  function pickTarget(difficulty, now) {
    let min, max;
    if (difficulty === 'easy') {
      const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
      min = 30 * 1000; max = Math.max(min + 1000, endOfDay.getTime() - now);
    } else if (difficulty === 'normal') { min = 5 * MIN; max = YEAR; }
    else { min = HOUR; max = 100 * YEAR; }
    return Math.round(now + min + Math.random() * (max - min));
  }
  const randomPos = () => ({
    x: Math.round(AREA.x0 + Math.random() * (AREA.x1 - AREA.x0)),
    y: Math.round(AREA.y0 + Math.random() * (AREA.y1 - AREA.y0)),
  });
  const inBox = (px, py, b) => px >= b.x - 1 && px < b.x + SIZE + 1 && py >= b.y - 1 && py < b.y + SIZE + 1;
  const menuButton = () => E.button('MENU', 2, 130, 34, 13, () => E.setScene(titleScene()));

  function goToLevel(level) {
    save.level = level;
    if (level === 3) save.target = pickTarget(save.difficulty, E.now());
    persist();
    E.setScene(levelScene());
  }

  /* ---------- notifications (level 3, opt-in) ---------- */
  const canNotify = () => 'Notification' in window;
  function notifyLabel() {
    if (!canNotify()) return 'NOTIFY: N/A';
    if (Notification.permission === 'denied') return 'NOTIFY: BLOCKED';
    return save.notify && Notification.permission === 'granted' ? 'NOTIFY: ON' : 'NOTIFY ME';
  }
  function toggleNotify() {
    if (!canNotify() || Notification.permission === 'denied') return;
    if (save.notify) { save.notify = false; persist(); return; }
    const done = (result) => { if (result === 'granted' && save) { save.notify = true; persist(); } };
    try {
      const asked = Notification.requestPermission(done);
      if (asked && asked.then) asked.then(done, () => {});
    } catch (e) { /* permission prompt unavailable */ }
  }
  function announce() {
    if (!save.notify || !canNotify() || Notification.permission !== 'granted') return;
    if (!document.hidden && document.hasFocus()) return;   // already looking at it
    try {
      const n = new Notification('Click the Box', { body: 'The box is here. You have 5 seconds.', tag: KEY });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) { /* some browsers only allow notifications from a service worker */ }
  }

  /* ---------- scenes ---------- */
  function titleScene(note) {
    return {
      name: 'title',
      draw(g, t) {
        E.title(g, ['CLICK THE BOX'], 24);
        if (E.blink(t)) g.text('PRESS START', W / 2, 52, { align: 'center' });
        if (note) g.text(note, W / 2, 118, { align: 'center' });
      },
      buttons: E.column([
        [save ? 'CONTINUE' : 'START', () => E.setScene(save ? levelScene() : difficultyScene())],
        ['RESET SAVE', () => {
          if (!save) { E.setScene(titleScene('NOTHING TO ERASE')); return; }
          E.setScene(E.confirm('ERASE YOUR SAVE?', () => { erase(); E.setScene(titleScene('SAVE CLEARED')); }, () => E.setScene(titleScene())));
        }],
      ], 72),
    };
  }

  function difficultyScene() {
    const start = (difficulty) => () => { save = { difficulty, level: 1, notify: false }; persist(); E.setScene(levelScene()); };
    return {
      name: 'difficulty',
      draw(g) { g.text('CHOOSE DIFFICULTY', W / 2, 20, { align: 'center' }); },
      buttons: E.column([['EASY', start('easy')], ['NORMAL', start('normal')], ['HARD', start('hard')], ['BACK', () => E.setScene(titleScene())]], 40),
    };
  }

  function levelScene() {
    return save.level === 1 ? level1() : save.level === 2 ? level2() : level3();
  }

  function level1() {
    const box = { x: (W - SIZE) / 2, y: 62 };
    return {
      name: 'level1',
      draw(g) { E.banner(g, 'LEVEL 1', 'CLICK THE BOX TO CONTINUE'); g.sprite(S.BOX, box.x, box.y); },
      pointer(px, py) { if (inBox(px, py, box)) goToLevel(2); },
      hot: (px, py) => inBox(px, py, box),
      buttons: [menuButton()],
    };
  }

  function level2() {
    const SPEED = 26;   // game pixels per second, per axis
    const box = { x: (W - SIZE) / 2, y: 62 };
    const vel = { x: Math.random() > 0.5 ? SPEED : -SPEED, y: Math.random() > 0.5 ? SPEED : -SPEED };
    let last = null, squash = null;   // squash: { axis, until }
    return {
      name: 'level2',
      update(now, t) {
        const dt = last === null ? 0 : Math.min(50, t - last) / 1000;
        last = t;
        box.x += vel.x * dt; box.y += vel.y * dt;
        if (box.x <= AREA.x0 || box.x >= AREA.x1) { vel.x = -vel.x; box.x = Math.max(AREA.x0, Math.min(box.x, AREA.x1)); squash = { axis: 'x', until: t + 120 }; }
        if (box.y <= AREA.y0 || box.y >= AREA.y1) { vel.y = -vel.y; box.y = Math.max(AREA.y0, Math.min(box.y, AREA.y1)); squash = { axis: 'y', until: t + 120 }; }
      },
      draw(g, t) {
        E.banner(g, 'LEVEL 2');
        if (squash && t < squash.until && !E.reduceMotion) {
          if (squash.axis === 'x') g.sprite(S.BOX_TALL, box.x + 1, box.y - 1);
          else g.sprite(S.BOX_WIDE, box.x - 1, box.y + 1);
        } else g.sprite(S.BOX, box.x, box.y);
      },
      pointer(px, py) { if (inBox(px, py, box)) goToLevel(3); },
      hot: (px, py) => inBox(px, py, box),
      buttons: [menuButton()],
    };
  }

  function level3() {
    const facts = save.difficulty === 'hard' && typeof FACTS !== 'undefined' ? FACTS : null;
    const nextFactDelay = () => 15 * MIN + Math.random() * 5 * MIN;   // 15-20 min between facts
    let visible = false, box = null;
    let fact = null, factUntil = 0, nextFactAt = E.now() + nextFactDelay();
    return {
      name: 'level3',
      update(now, t) {
        if (now >= save.target + SHOW_MS) {             // came and went
          erase(); E.setScene(loseScene()); return;
        }
        if (now >= save.target) {
          if (!visible) { visible = true; box = randomPos(); fact = null; announce(); }
          return;
        }
        // Hard mode flavor facts. Cosmetic only: they never hint at the timing.
        if (!facts) return;
        if (fact && t >= factUntil) { fact = null; nextFactAt = now + nextFactDelay(); }
        if (!fact && now >= nextFactAt) {
          fact = facts[Math.floor(Math.random() * facts.length)];
          factUntil = t + 3500 + Math.random() * 2500;
        }
      },
      draw(g) {
        E.banner(g, 'LEVEL 3');
        if (visible) g.sprite(S.BOX, box.x, box.y);
        else if (fact) g.para(fact, W / 2, 48);
        if (!visible && notifyLabel() === 'NOTIFY: ON') g.text('KEEP THIS TAB OPEN', W / 2, 120, { align: 'center' });
      },
      pointer(px, py) {
        if (visible && inBox(px, py, box)) { erase(); E.setScene(winScene()); }
      },
      hot: (px, py) => visible && inBox(px, py, box),
      buttons: () => [menuButton(), E.button(notifyLabel(), W - 98, 130, 96, 13, toggleNotify)],
    };
  }

  function winScene() {
    return {
      name: 'win',
      draw(g) { E.title(g, ['YOU WIN'], 40); },
      buttons: E.column([['PLAY AGAIN', () => E.setScene(titleScene())]], 80),
    };
  }
  function loseScene() {
    return {
      name: 'lose',
      draw(g) { E.title(g, ['GAME OVER'], 30); g.para('THE BOX CAME AND WENT.', W / 2, 58); },
      buttons: E.column([['TRY AGAIN', () => E.setScene(titleScene())]], 84),
    };
  }

  E.mount();
  E.setScene(save ? levelScene() : titleScene());
})();
