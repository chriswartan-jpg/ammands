(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  createGlobe(document.getElementById("globe"));
  createSun(document.getElementById("sun"));

  /* ---------- Sun drawn in text characters ----------
     A bright core of dense glyphs with a corona that thins out. Now and then,
     a few seconds apart and never on a fixed beat, rays shoot out and fade. */

  function createSun(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const RAMP = " .·:;~-=+*o#%@";
    const FONT = "'IBM Plex Mono', ui-monospace, Menlo, monospace";
    const CORE = 0.085;  // core radius, as a share of half the canvas
    const REACH = 0.5;   // corona stops here

    let size = 0;
    let dpr = 1;
    let cell = 6;
    let cols = 0;
    let lastDraw = -Infinity;
    const rays = [];
    let nextBurst = performance.now() + 2500 + Math.random() * 3000;

    function resize() {
      size = canvas.getBoundingClientRect().width;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      cell = Math.max(5, Math.round(size / 64));
      cols = Math.max(10, Math.floor(size / cell));
      lastDraw = -Infinity;
    }
    new ResizeObserver(resize).observe(canvas);
    resize();

    function burst(now) {
      const count = 5 + Math.floor(Math.random() * 5);
      const start = Math.random() * Math.PI * 2;
      for (let n = 0; n < count; n++) {
        rays.push({
          angle: start + (n / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6,
          born: now + Math.random() * 300,
          length: 0.7 + Math.random() * 0.25
        });
      }
    }

    function draw(time) {
      requestAnimationFrame(draw);
      if (time - lastDraw < 50 || size === 0) return;
      lastDraw = time;

      if (!reduceMotion && time > nextBurst) {
        burst(time);
        nextBurst = time + 5000 + Math.random() * 8000; // sometimes, not on a beat
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const half = cols / 2;
      const offset = (size - cols * cell) / 2;
      const centre = size / 2;

      // soft warm haze underneath the glyphs
      const haze = ctx.createRadialGradient(centre, centre, 0, centre, centre, size * 0.32);
      haze.addColorStop(0, "rgba(255, 190, 120, 0.22)");
      haze.addColorStop(1, "rgba(255, 150, 80, 0)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, size, size);

      // the corona glows a little brighter while rays are out
      let boost = 0;
      for (const ray of rays) {
        const age = time - ray.born;
        if (age > 0) boost = Math.max(boost, Math.max(0, 1 - Math.abs(age - 700) / 1400));
      }

      ctx.font = `${Math.round(cell * 1.3)}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const slot = reduceMotion ? 0 : Math.floor(time / 180);

      for (let j = 0; j < cols; j++) {
        const dy = (j + 0.5 - half) / half;
        const py = offset + (j + 0.5) * cell;
        for (let i = 0; i < cols; i++) {
          const dx = (i + 0.5 - half) / half;
          const r = Math.hypot(dx, dy);
          if (r > REACH) continue;

          let level = r < CORE ? 1 : 0.95 * Math.exp(-(r - CORE) * 7.5) * (1 + boost * 0.45);
          if (level < 0.05) continue;
          level = Math.min(1, level);

          const noise = hash(i, j, slot);
          let k = Math.round(level * (RAMP.length - 1));
          if (noise < 0.08) k += 1;
          else if (noise > 0.92) k -= 1;
          k = Math.max(0, Math.min(RAMP.length - 1, k));
          if (k === 0) continue;

          const t = r < CORE ? 0 : Math.min(1, (r - CORE) / 0.3);
          const red = 255;
          const green = Math.round(250 - 100 * t);
          const blue = Math.round(240 - 160 * t);
          ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${Math.min(1, 0.12 + level)})`;
          ctx.fillText(RAMP[k], offset + (i + 0.5) * cell, py);
        }
      }

      // rays: grow outwards, hold for a moment, then fade
      for (let n = rays.length - 1; n >= 0; n--) {
        const ray = rays[n];
        const age = time - ray.born;
        if (age < 0) continue;
        const grow = Math.min(1, age / 1100);
        const fade = age > 1400 ? 1 - (age - 1400) / 1600 : 1;
        if (fade <= 0) { rays.splice(n, 1); continue; }

        const reach = ray.length * grow;
        const step = 1 / half;
        const cos = Math.cos(ray.angle);
        const sin = Math.sin(ray.angle);
        for (let d = CORE + step; d < reach; d += step) {
          const gi = Math.floor(half + cos * d * half);
          const gj = Math.floor(half + sin * d * half);
          if (hash(gi, gj, slot + n) < 0.12) continue; // broken, cryptic line
          const strength = (1 - d / ray.length) * fade;
          if (strength <= 0.04) continue;
          const glyph = strength > 0.6 ? "=" : strength > 0.35 ? "-" : strength > 0.18 ? "~" : "·";
          ctx.fillStyle = `rgba(255, 222, 170, ${Math.min(1, 0.15 + strength * 1.1)})`;
          ctx.fillText(glyph, offset + (gi + 0.5) * cell, offset + (gj + 0.5) * cell);
        }
      }
    }
    requestAnimationFrame(draw);
  }

  /* ---------- Globe drawn in text characters ----------
     The planet is sampled on a grid. Each cell gets a character whose density
     follows the sunlight: dense glyphs on the lit land, sparse dots on the ocean
     and the night side, dissolving towards the rim. */

  function createGlobe(canvas) {
    const ctx = canvas.getContext("2d");
    const d3 = window.d3;
    const RAMP = " .·:;~-=+*o#%@";
    const LIGHT = normalize([0.55, 0.42, 0.72]); // sun: right, up, towards the viewer
    const FONT = "'IBM Plex Mono', ui-monospace, Menlo, monospace";
    const SPHERE = 0.42; // radius as a share of the grid

    const mask = document.createElement("canvas");
    const mctx = mask.getContext("2d", { willReadFrequently: true });
    const projection = d3 ? d3.geoOrthographic().clipAngle(90).precision(0.6) : null;

    let land = null;
    let size = 0;
    let dpr = 1;
    let cell = 7;
    let cols = 0;
    let lon0 = 10;   // longitude facing the viewer
    let lat0 = 22;   // latitude facing the viewer
    let dragging = null;
    let pausedUntil = 0;
    let lastTime = null;
    let lastDraw = -Infinity;

    function resize() {
      size = canvas.getBoundingClientRect().width;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      cell = Math.max(5, Math.round(size / 92));
      cols = Math.max(20, Math.floor(size / cell));
      mask.width = cols;
      mask.height = cols;
      if (projection) projection.scale(cols * SPHERE).translate([cols / 2, cols / 2]);
      lastDraw = -Infinity;
    }
    new ResizeObserver(resize).observe(canvas);
    resize();

    loadLand().then((feature) => { land = feature; lastDraw = -Infinity; }).catch(() => { land = null; });

    function update(time) {
      const dt = lastTime == null ? 16 : Math.min(64, time - lastTime);
      lastTime = time;
      if (!dragging && !reduceMotion && time > pausedUntil) {
        lon0 -= dt * 0.004; // slow spin, about 90 seconds per turn
      }
    }

    function draw(time) {
      requestAnimationFrame(draw);
      update(time);
      if (time - lastDraw < 40) return; // about 25 frames a second is plenty for text
      lastDraw = time;

      // Land mask at grid resolution: one pixel per character cell
      let landData = null;
      if (projection && land) {
        projection.rotate([-lon0, -lat0]);
        mctx.clearRect(0, 0, cols, cols);
        mctx.fillStyle = "#fff";
        mctx.beginPath();
        d3.geoPath(projection, mctx)(land);
        mctx.fill();
        landData = mctx.getImageData(0, 0, cols, cols).data;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const offset = (size - cols * cell) / 2;
      const radiusPx = cols * SPHERE * cell;
      const centre = size / 2;

      // A faint haze around the planet, so the rim fades into the sky
      const haze = ctx.createRadialGradient(centre, centre, radiusPx * 0.7, centre, centre, radiusPx * 1.3);
      haze.addColorStop(0, "rgba(160, 130, 200, 0.10)");
      haze.addColorStop(1, "rgba(160, 130, 200, 0)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, size, size);

      ctx.font = `${Math.round(cell * 1.3)}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const slot = reduceMotion ? 0 : Math.floor(time / 160); // glyphs shimmer a few times a second
      const half = cols / 2;
      const rad = cols * SPHERE;

      for (let j = 0; j < cols; j++) {
        const y = -(j + 0.5 - half) / rad;
        const py = offset + (j + 0.5) * cell;
        for (let i = 0; i < cols; i++) {
          const x = (i + 0.5 - half) / rad;
          const r2 = x * x + y * y;
          const px = offset + (i + 0.5) * cell;
          const noise = hash(i, j, slot);

          if (r2 > 1) {
            // loose dust just outside the planet
            if (r2 < 1.35 && noise < 0.035) {
              ctx.fillStyle = `rgba(190, 170, 220, ${0.35 * (1.35 - r2)})`;
              ctx.fillText(noise < 0.017 ? "." : "·", px, py);
            }
            continue;
          }

          const z = Math.sqrt(1 - r2);
          const sun = Math.max(0, x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2]);
          const isLand = landData ? landData[(j * cols + i) * 4 + 3] > 110 : false;
          const rim = 1 - smoothstep(0.72, 1, Math.sqrt(r2)) * 0.8;
          const level = (isLand ? 0.08 + 0.92 * sun : 0.05 + 0.36 * sun) * rim;
          if (level < 0.04) continue;

          let k = Math.round(level * (RAMP.length - 1));
          if (noise < 0.07) k += 1;
          else if (noise > 0.93) k -= 1;
          k = Math.max(0, Math.min(RAMP.length - 1, k));
          if (k === 0) continue;

          const alpha = Math.min(1, 0.18 + level * 0.95);
          if (isLand) {
            // sunlit land: cream turning to sunlight, with a faint pixel block behind
            if (level > 0.5) {
              ctx.fillStyle = `rgba(255, 201, 138, ${(level - 0.5) * 0.22})`;
              ctx.fillRect(px - cell / 2, py - cell / 2, cell, cell);
            }
            const warm = Math.min(1, sun * 1.2);
            ctx.fillStyle = `rgba(${Math.round(252 + 3 * warm)}, ${Math.round(246 - 45 * warm)}, ${Math.round(239 - 101 * warm)}, ${alpha})`;
          } else {
            // ocean: cool lilac
            ctx.fillStyle = `rgba(150, 150, 215, ${alpha * 0.85})`;
          }
          ctx.fillText(RAMP[k], px, py);
        }
      }
    }
    requestAnimationFrame(draw);

    /* Drag to turn the globe */
    function localPoint(event) {
      const rect = canvas.getBoundingClientRect();
      return [event.clientX - rect.left, event.clientY - rect.top];
    }
    canvas.addEventListener("pointerdown", (event) => {
      dragging = { last: localPoint(event) };
      canvas.classList.add("is-dragging");
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const point = localPoint(event);
      const toDeg = 180 / Math.PI;
      const radiusPx = cols * SPHERE * cell;
      lon0 -= ((point[0] - dragging.last[0]) / radiusPx) * toDeg;
      lat0 = Math.max(-70, Math.min(70, lat0 + ((point[1] - dragging.last[1]) / radiusPx) * toDeg));
      dragging.last = point;
    });
    function endDrag() {
      dragging = null;
      canvas.classList.remove("is-dragging");
      pausedUntil = performance.now() + 3000;
    }
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
  }

  function normalize(v) {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  function smoothstep(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  // Cheap repeatable noise per cell and time slot
  function hash(i, j, slot) {
    const s = Math.sin(i * 12.9898 + j * 78.233 + slot * 37.719) * 43758.5453;
    return s - Math.floor(s);
  }

  // Land shapes from Natural Earth (world-atlas).
  async function loadLand() {
    if (!window.d3 || !window.topojson) throw new Error("Map libraries not loaded");
    const response = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json");
    if (!response.ok) throw new Error("Land data not available");
    const topology = await response.json();
    return window.topojson.feature(topology, topology.objects.land);
  }
})();
