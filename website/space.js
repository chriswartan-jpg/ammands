(function () {
  "use strict";

  // Fixed starfield behind the page. The stars come from a fixed seed, so they
  // stay in the same place when you move between pages.
  const canvas = document.createElement("canvas");
  canvas.className = "space";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");

  let timer = null;

  function seeded(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function draw() {
    const random = seeded(20261120);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const count = Math.round((w * h) / 3200);
    for (let i = 0; i < count; i++) {
      const big = random() < 0.06;
      const r = big ? 0.9 + random() * 0.8 : 0.25 + random() * 0.6;
      const a = big ? 0.6 + random() * 0.35 : 0.15 + random() * 0.5;
      const warm = random() < 0.3;
      const x = random() * w;
      const y = random() * h;
      ctx.fillStyle = warm ? `rgba(255, 228, 200, ${a})` : `rgba(225, 232, 255, ${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Page transitions can be skipped (for example when someone clicks again
  // before the animation ends). That is fine, so don't report it as an error.
  function quietTransition(event) {
    const vt = event.viewTransition;
    if (!vt) return;
    vt.ready.catch(() => {});
    vt.finished.catch(() => {});
    if (vt.updateCallbackDone) vt.updateCallbackDone.catch(() => {});
  }
  window.addEventListener("pagereveal", quietTransition);
  window.addEventListener("pageswap", quietTransition);

  draw();
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(draw, 150);
  });
})();
