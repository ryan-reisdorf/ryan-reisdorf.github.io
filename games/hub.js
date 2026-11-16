/* Draws the 1-bit preview art on the games hub cards. */
(() => {
  'use strict';
  const E = Engine, S = Sprites;
  const PW = 160, PH = 120;
  const art = {
    box(g) {
      g.sprite(S.BOX, 72, 52);
      g.frame(66, 46, 28, 28); g.frame(60, 40, 40, 40);
    },
    plant(g) {
      g.rect(40, 108, 80, 1);
      S.drawPot(g, 80, 108);
      S.drawPlant(g, { cx: 80, base: 94, growth: 100, bloomed: true, still: true });
    },
    palm(g) {
      g.rect(0, 112, PW, 1);
      S.drawPalm(g, { still: true, oy: -16 });
      S.SLOTS.forEach(([x, y], i) => S.drawCoconut(g, x, y - 16, i % 3 === 0 ? 4 : 3));
    },
  };
  const previews = [...document.querySelectorAll('canvas[data-preview]')].map((canvas) => {
    const buffer = document.createElement('canvas');
    buffer.width = PW; buffer.height = PH;
    const g = E.makeGfx(buffer);
    g.clear();
    art[canvas.dataset.preview](g);
    return { canvas, buffer };
  });
  const render = () => previews.forEach(({ canvas, buffer }) => {
    const box = canvas.parentElement;
    E.present(buffer, canvas, box.clientWidth, box.clientHeight, true);
  });
  render();
  window.addEventListener('resize', render);
})();
