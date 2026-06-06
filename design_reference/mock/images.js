/* ------------------------------------------------------------------
   Procedural placeholder aerial imagery.
   Mirrors the real API's "three rotating placeholders": a small set of
   deterministic base scenes, picked by hash(image_id). Rendered once to
   canvas, cached as data URLs. Camera type drives the scene family
   (nadir solar, thermal IR, perimeter ground).
-------------------------------------------------------------------*/
(function () {
  const cache = new Map();

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0);
  }
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function mk(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  function grain(ctx, w, h, amt, alpha) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amt;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }
  function vignette(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.8);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  /* ---- nadir solar array ---- */
  function solar(ctx, w, h, seed) {
    const r = rng(seed);
    ctx.fillStyle = "#4a4332";
    ctx.fillRect(0, 0, w, h);
    // dirt texture
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = `rgba(${110 + r() * 40},${100 + r() * 35},${70 + r() * 30},0.5)`;
      ctx.fillRect(r() * w, r() * h, 2, 2);
    }
    const ang = (-12 + r() * 24) * Math.PI / 180;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(ang);
    const rows = 4 + Math.floor(r() * 2);
    const rowH = 52, gap = 30, panW = w * 1.4, perRow = 9;
    for (let ry = 0; ry < rows; ry++) {
      const y = -rows * (rowH + gap) / 2 + ry * (rowH + gap);
      ctx.fillStyle = "#101826";
      ctx.fillRect(-panW / 2, y, panW, rowH);
      for (let p = 0; p < perRow; p++) {
        const px = -panW / 2 + p * (panW / perRow);
        const glint = r();
        ctx.fillStyle = glint > 0.92 ? "#3b5bdb" : `rgb(${20 + glint * 30},${34 + glint * 40},${70 + glint * 60})`;
        ctx.fillRect(px + 3, y + 4, panW / perRow - 6, rowH - 8);
      }
      // defect cell (warm)
      if (r() > 0.6) {
        ctx.fillStyle = "rgba(220,140,60,0.8)";
        const px = -panW / 2 + Math.floor(r() * perRow) * (panW / perRow);
        ctx.fillRect(px + 6, y + 8, 18, rowH - 16);
      }
    }
    ctx.restore();
    grain(ctx, w, h, 26);
    vignette(ctx, w, h);
  }

  /* ---- thermal IR false color ---- */
  function thermal(ctx, w, h, seed) {
    const r = rng(seed);
    // cool base
    ctx.fillStyle = "#10122a";
    ctx.fillRect(0, 0, w, h);
    const blobs = 3 + Math.floor(r() * 3);
    for (let b = 0; b < blobs; b++) {
      const cx = r() * w, cy = r() * h, rad = 40 + r() * 90;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const hot = r();
      g.addColorStop(0, hot > 0.5 ? "rgba(255,238,140,0.95)" : "rgba(240,120,60,0.9)");
      g.addColorStop(0.4, "rgba(200,60,90,0.6)");
      g.addColorStop(0.75, "rgba(90,30,120,0.5)");
      g.addColorStop(1, "rgba(20,24,60,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    // faint structure grid
    ctx.strokeStyle = "rgba(120,160,220,0.12)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 46) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 46) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    grain(ctx, w, h, 18);
    vignette(ctx, w, h);
  }

  /* ---- perimeter / ground ---- */
  function ground(ctx, w, h, seed) {
    const r = rng(seed);
    ctx.fillStyle = "#3b4a2e";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const g = 50 + r() * 70;
      ctx.fillStyle = `rgba(${g * 0.7},${g},${g * 0.5},0.5)`;
      ctx.fillRect(r() * w, r() * h, 2, 3);
    }
    // gravel road / fence diagonal
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((-20 + r() * 40) * Math.PI / 180);
    ctx.fillStyle = "#6b6457";
    ctx.fillRect(-w, -18, w * 2, 36);
    ctx.strokeStyle = "rgba(20,24,18,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-w, -30); ctx.lineTo(w, -30); ctx.stroke();
    for (let x = -w; x < w; x += 28) {
      ctx.beginPath(); ctx.moveTo(x, -36); ctx.lineTo(x, -24); ctx.stroke();
    }
    ctx.restore();
    grain(ctx, w, h, 22);
    vignette(ctx, w, h);
  }

  const FAMILY = {
    thermal: thermal,
    patrol: ground,
    inspection: solar,
    mosaic: solar,
  };

  function render(missionType, variant, image_id) {
    const w = 640, h = 480;
    const c = mk(w, h);
    const ctx = c.getContext("2d");
    const fn = FAMILY[missionType] || solar;
    fn(ctx, w, h, hash(image_id) + variant * 7919);
    return c.toDataURL("image/jpeg", 0.82);
  }

  window.CaptureImages = {
    get(missionType, image_id) {
      const key = missionType + "|" + image_id;
      if (cache.has(key)) return cache.get(key);
      const variant = hash(image_id) % 3; // three rotating bases
      const url = render(missionType, variant, image_id);
      cache.set(key, url);
      return url;
    },
  };
})();
