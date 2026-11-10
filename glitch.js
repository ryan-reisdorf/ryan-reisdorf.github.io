// Hover glitch for cards marked [data-glitch]: chromatic streaks, scanlines, pixel noise.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPECTRUM = ['#2a2a2a', '#555', '#8a8a8a', '#c4c4c4', '#fff', '#c4c4c4', '#8a8a8a', '#3a3a3a'];
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function makeBands(h) {
    const bands = [];
    let y = 0;
    while (y < h) {
      const bh = rand(4, 28);
      bands.push({
        y, h: bh,
        side: Math.random() < 0.5 ? 0 : 1,  // streak cluster on left or right
        x: rand(-0.1, 0.25), w: rand(0.35, 0.8), a: rand(0.35, 1),
      });
      y += bh;
    }
    return bands;
  }

  function draw(ctx, w, h, bands, t) {
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, w, h);

    for (const b of bands) {
      const jitter = Math.random() < 0.15 ? rand(-0.15, 0.15) : 0;
      const bw = b.w * w;
      let x0 = (b.side ? w - bw - b.x * w : b.x * w) + jitter * w + Math.sin(t / 300 + b.y) * 6;
      const g = ctx.createLinearGradient(x0, 0, x0 + bw, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      const stops = b.side ? SPECTRUM : [...SPECTRUM].reverse();
      stops.forEach((c, i) => g.addColorStop(0.1 + (i / (stops.length - 1)) * 0.8, c));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = b.a * rand(0.8, 1);
      ctx.fillStyle = g;
      ctx.fillRect(x0, b.y, bw, b.h);
    }
    ctx.globalAlpha = 1;

    // Scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

    // Pixel noise
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = pick(SPECTRUM);
      ctx.globalAlpha = rand(0.3, 0.9);
      ctx.fillRect(rand(0, w), rand(0, h), rand(1, 8), rand(1, 3));
    }
    ctx.globalAlpha = 1;
  }

  document.querySelectorAll('[data-glitch]').forEach((card) => {
    const media = card.querySelector('.card-media');
    const canvas = document.createElement('canvas');
    canvas.className = 'glitch-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    media.prepend(canvas);
    const ctx = canvas.getContext('2d');
    let raf = 0, bands = [], last = 0, w = 0, h = 0;

    const size = () => {
      const r = media.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bands = makeBands(h);
    };

    const loop = (t) => {
      if (t - last > 70) {
        if (Math.random() < 0.3) bands = makeBands(h);
        draw(ctx, w, h, bands, t);
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      size();
      card.classList.add('is-glitching');
      if (reduce) draw(ctx, w, h, bands, 0);
      else { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
    };
    const stop = () => {
      card.classList.remove('is-glitching');
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, w, h);
    };

    card.addEventListener('pointerenter', start);
    card.addEventListener('pointerleave', stop);
    card.addEventListener('focus', start);
    card.addEventListener('blur', stop);
  });
})();
