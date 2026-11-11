// Home Lab card hover: logos hop into a box one by one, the box slides to the
// center, its bottom flaps open, the logos drop back into place. Loops.
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  document.querySelectorAll('[data-crate]').forEach((card) => {
    const media = card.querySelector('.card-media');
    const icons = [...media.querySelectorAll('.icon')];
    const crate = document.createElement('div');
    crate.className = 'crate';
    crate.setAttribute('aria-hidden', 'true');
    crate.innerHTML = '<span class="flap left"></span><span class="flap right"></span>';
    media.appendChild(crate);
    const [flapL, flapR] = crate.querySelectorAll('.flap');

    let run = 0;
    const live = new Set();
    const anim = (el, frames, opts) => {
      const a = el.animate(frames, { fill: 'forwards', ...opts });
      live.add(a);
      return a.finished.catch(() => {});
    };

    const center = (el) => {
      const m = media.getBoundingClientRect(), r = el.getBoundingClientRect();
      return { x: r.left - m.left + r.width / 2, y: r.top - m.top + r.height / 2 };
    };

    async function loop(id) {
      while (id === run) {
        const m = media.getBoundingClientRect();
        const cw = crate.offsetWidth, ch = crate.offsetHeight;
        const startPos = { x: m.width - cw / 2 - 20, y: m.height * 0.22 };
        const midPos = { x: m.width / 2, y: m.height * 0.22 };
        const at = (p) => `translate(${p.x - cw / 2}px, ${p.y - ch / 2}px)`;
        const home = icons.map(center);

        // Box appears at the right.
        crate.style.transform = at(startPos);
        await anim(crate, [{ transform: at(startPos), opacity: 0 }, { transform: at(startPos), opacity: 1 }], { duration: 300 });
        if (id !== run) return;

        // Logos hop in one by one.
        for (let i = 0; i < icons.length; i++) {
          const dx = startPos.x - home[i].x, dy = startPos.y - home[i].y;
          anim(icons[i], [
            { transform: 'translate(0,0) scale(1)', opacity: 1 },
            { transform: `translate(${dx / 2}px, ${dy - 40}px) scale(.85)`, opacity: 1, offset: 0.5 },
            { transform: `translate(${dx}px, ${dy}px) scale(.5)`, opacity: 0 },
          ], { duration: 450, easing: 'ease-in-out' });
          await wait(220);
          if (id !== run) return;
        }
        await wait(400);
        if (id !== run) return;

        // Box slides to the center.
        await anim(crate, [{ transform: at(startPos) }, { transform: at(midPos) }], { duration: 650, easing: 'cubic-bezier(.6,0,.3,1)' });
        if (id !== run) return;

        // Flaps open, logos drop back home.
        anim(flapL, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(80deg)' }], { duration: 220, easing: 'ease-out' });
        await anim(flapR, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-80deg)' }], { duration: 220, easing: 'ease-out' });
        if (id !== run) return;
        icons.forEach((el, i) => {
          const dx = midPos.x - home[i].x, dy = midPos.y - home[i].y;
          anim(el, [
            { transform: `translate(${dx}px, ${dy}px) scale(.5)`, opacity: 0 },
            { transform: `translate(${dx * 0.6}px, ${dy * 0.4}px) scale(.8)`, opacity: 1, offset: 0.35 },
            { transform: 'translate(0, 6px) scale(1)', opacity: 1, offset: 0.85 },
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          ], { duration: 700, delay: i * 70, easing: 'cubic-bezier(.4,0,.6,1)' });
        });
        await wait(700 + icons.length * 70);
        if (id !== run) return;

        // Close up, fade the box, pause, repeat.
        anim(flapL, [{ transform: 'rotate(80deg)' }, { transform: 'rotate(0deg)' }], { duration: 200 });
        anim(flapR, [{ transform: 'rotate(-80deg)' }, { transform: 'rotate(0deg)' }], { duration: 200 });
        await anim(crate, [{ transform: at(midPos), opacity: 1 }, { transform: at(midPos), opacity: 0 }], { duration: 350, delay: 150 });
        await wait(500);
        live.forEach((a) => a.cancel());
        live.clear();
      }
    }

    const start = () => { run++; loop(run); };
    const stop = () => { run++; live.forEach((a) => a.cancel()); live.clear(); };
    card.addEventListener('pointerenter', start);
    card.addEventListener('pointerleave', stop);
  });
})();
