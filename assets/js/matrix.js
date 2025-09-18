(function () {
  const canvas = document.getElementById('matrix-canvas');
  const ctx = canvas.getContext('2d');

  const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildMask();
    initColumns();
  }
  window.addEventListener('resize', resize);

  const glyphs = 'アイウエオカキクケコｻｼｽｾｿ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&+*-=';
  const glyphArr = glyphs.split('');
  const FONT_SIZE = 18;
  const TRAIL_ALPHA = 0.08;

  let columns = 0;
  let drops = [];

  function initColumns() {
    columns = Math.ceil(canvas.clientWidth / FONT_SIZE);
    drops = new Array(columns).fill(0).map(() => Math.floor(Math.random() * -40));
  }

  let maskCanvas, maskCtx, maskData, maskW, maskH;
  const NAME = 'RYAN REISDORF';

  function buildMask() {
    maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.clientWidth;
    maskCanvas.height = canvas.clientHeight;
    maskCtx = maskCanvas.getContext('2d');

    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

    const vw = maskCanvas.width;
    const vh = maskCanvas.height;
    let fontSize = Math.min(Math.floor(vw * 0.12), Math.floor(vh * 0.22));
    fontSize = Math.max(fontSize, 42);

    maskCtx.font = `${fontSize}px "Courier New", monospace`;
    maskCtx.textAlign = 'center';
    maskCtx.textBaseline = 'middle';
    maskCtx.fillStyle = '#fff';
    maskCtx.fillText(NAME, vw / 2, vh / 2);

    maskW = maskCanvas.width;
    maskH = maskCanvas.height;
    maskData = maskCtx.getImageData(0, 0, maskW, maskH).data;
  }

  function isNamePixel(x, y) {
    if (x < 0 || y < 0 || x >= maskW || y >= maskH) return false;
    const idx = ((y | 0) * maskW + (x | 0)) * 4 + 3;
    return maskData[idx] > 10;
  }

  resize();

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.fillStyle = `rgba(0,0,0,${TRAIL_ALPHA})`;
    ctx.fillRect(0, 0, w, h);

    ctx.font = `${FONT_SIZE}px "Courier New", monospace`;
    ctx.textBaseline = 'top';

    for (let i = 0; i < columns; i++) {
      const x = i * FONT_SIZE;
      const y = drops[i] * FONT_SIZE;

      const ch = glyphArr[(Math.random() * glyphArr.length) | 0];
      const sampleX = x + FONT_SIZE * 0.3;
      const sampleY = y + FONT_SIZE * 0.6;
      const inName = isNamePixel(sampleX, sampleY);

      if (inName) {
        ctx.fillStyle = '#00ff41';
        ctx.fillText(ch, x, y);
        ctx.fillStyle = 'rgba(0,255,65,0.6)';
        ctx.fillText(ch, x, y);
      } else {
        ctx.fillStyle = 'rgba(0,255,65,0.5)';
        ctx.fillText(ch, x, y);
      }

      drops[i] += inName ? 0.65 : 1;

      if (y > h && Math.random() > 0.975) {
        drops[i] = Math.floor(Math.random() * -20);
      }
    }
    requestAnimationFrame(draw);
  }

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  requestAnimationFrame(draw);
})();
