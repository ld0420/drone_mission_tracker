/* ------------------------------------------------------------------
   Mission Tracker — mock data layer
   Mirrors the take-home API shapes (GET /api/missions, /:id, /:id/captures).
   All geometry is generated in a local ENU plane around the demo site,
   then projected to WGS84 so it sits on real satellite imagery.
-------------------------------------------------------------------*/
(function () {
  const SITE = { lat: 33.252968, lon: -91.664321 };
  const M_PER_DEG_LAT = 111320;
  const cosLat = Math.cos((SITE.lat * Math.PI) / 180);
  const M_PER_DEG_LON = M_PER_DEG_LAT * cosLat;

  // east (x, meters), north (y, meters) -> {lat, lon}
  function enu(x, y) {
    return {
      lat: SITE.lat + y / M_PER_DEG_LAT,
      lon: SITE.lon + x / M_PER_DEG_LON,
    };
  }
  // bearing of vector (east dx, north dy) -> deg clockwise from N, 0..360
  function bearing(dx, dy) {
    let b = (Math.atan2(dx, dy) * 180) / Math.PI;
    return (b + 360) % 360;
  }
  function r2(n) { return Math.round(n * 100) / 100; }
  function pad4(n) { return String(n).padStart(4, "0"); }

  /* ---------- pattern coordinate builders (return {x,y} arrays) ---------- */

  function serpentine(N, rows, W, H) {
    const x0 = -W / 2, y0 = -H / 2;
    const cols = Math.ceil(N / rows);
    const pts = [];
    for (let r = 0; r < rows && pts.length < N; r++) {
      const y = rows > 1 ? y0 + (H * r) / (rows - 1) : 0;
      for (let c = 0; c < cols && pts.length < N; c++) {
        const f = cols > 1 ? c / (cols - 1) : 0;
        const frac = r % 2 === 0 ? f : 1 - f;
        pts.push({ x: x0 + W * frac, y });
      }
    }
    return pts;
  }

  function perimeter(N, W, H) {
    // rectangle perimeter, evenly spaced, outward-facing heading
    const hw = W / 2, hh = H / 2;
    const corners = [
      { x: -hw, y: -hh }, { x: hw, y: -hh },
      { x: hw, y: hh }, { x: -hw, y: hh },
    ];
    const segLen = [];
    let total = 0;
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      const l = Math.hypot(b.x - a.x, b.y - a.y);
      segLen.push(l); total += l;
    }
    const pts = [];
    for (let i = 0; i < N; i++) {
      let d = (total * i) / N;
      let s = 0;
      while (d > segLen[s]) { d -= segLen[s]; s++; }
      const a = corners[s], b = corners[(s + 1) % 4];
      const t = d / segLen[s];
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      pts.push({ x, y, heading: bearing(x, y) }); // outward from centroid
    }
    return pts;
  }

  function orbits(N, hotspots, radius) {
    const pts = [];
    const per = Math.floor(N / hotspots.length);
    let made = 0;
    hotspots.forEach((h, hi) => {
      const count = hi === hotspots.length - 1 ? N - made : per;
      for (let i = 0; i < count; i++) {
        const ang = (2 * Math.PI * i) / count;
        const x = h.x + radius * Math.sin(ang);
        const y = h.y + radius * Math.cos(ang);
        pts.push({ x, y, heading: bearing(h.x - x, h.y - y) }); // inward
        made++;
      }
    });
    return pts;
  }

  // assign travel-direction heading to points that don't carry one
  function travelHeadings(pts) {
    return pts.map((p, i) => {
      if (typeof p.heading === "number") return p;
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      return { ...p, heading: bearing(b.x - a.x, b.y - a.y) };
    });
  }

  /* ---------- mission definitions ---------- */

  const DEFS = [
    {
      id: "msn-grid-1", name: "Solar Array Grid Inspection", type: "inspection",
      status: "complete", started: "2026-05-26T14:12:00.000Z", duration: 751,
      drone: { model: "Sentinel X1", serial: "SX1-A4F2-9921" },
      site: { id: "site-demo-001", name: "Greenfield Solar" },
      cameraNote: "Nadir · solar string thermography",
      build: () => travelHeadings(serpentine(144, 12, 320, 300)), alt: 35,
    },
    {
      id: "msn-patrol-2", name: "Perimeter Security Patrol", type: "patrol",
      status: "complete", started: "2026-05-24T09:05:00.000Z", duration: 642,
      drone: { model: "Sentinel X1", serial: "SX1-A4F2-9921" },
      site: { id: "site-demo-001", name: "Greenfield Solar" },
      cameraNote: "Outward-facing · fence-line watch",
      build: () => perimeter(122, 380, 340), alt: 42,
    },
    {
      id: "msn-thermal-3", name: "Thermal Anomaly Sweep", type: "thermal",
      status: "complete", started: "2026-05-22T16:40:00.000Z", duration: 818,
      drone: { model: "Sentinel T2", serial: "ST2-7C13-4480" },
      site: { id: "site-demo-001", name: "Greenfield Solar" },
      cameraNote: "Inward orbit · radiometric IR",
      build: () => orbits(140, [
        { x: -110, y: 80 }, { x: 90, y: 110 }, { x: 130, y: -70 },
        { x: -90, y: -100 }, { x: 0, y: 0 },
      ], 34), alt: 55,
    },
    {
      id: "msn-health-4", name: "Routine Site Health Check", type: "inspection",
      status: "complete", started: "2026-05-20T11:30:00.000Z", duration: 904,
      drone: { model: "Sentinel X1", serial: "SX1-9E07-1145" },
      site: { id: "site-demo-001", name: "Greenfield Solar" },
      cameraNote: "Nadir · low-altitude serpentine",
      build: () => travelHeadings(serpentine(174, 14, 300, 280)), alt: 24,
    },
    {
      id: "msn-aborted-5", name: "Aborted Inspection (Low Battery)", type: "inspection",
      status: "aborted", started: "2026-05-27T07:48:00.000Z", duration: 412,
      abort_reason: "Battery fell to 18% — below RTL safety threshold. Auto-aborted and returned to dock.",
      drone: { model: "Sentinel X1", serial: "SX1-A4F2-9921" },
      site: { id: "site-demo-001", name: "Greenfield Solar" },
      cameraNote: "Nadir · ended mid-grid",
      build: () => travelHeadings(serpentine(79, 8, 320, 170)), alt: 30,
    },
    {
      id: "msn-tower-6", name: "Comms Tower Structural Scan", type: "inspection",
      status: "complete", started: "2026-05-18T13:20:00.000Z", duration: 506,
      drone: { model: "Sentinel T2", serial: "ST2-7C13-4480" },
      site: { id: "site-demo-001", name: "Greenfield Solar" },
      cameraNote: "Inward orbit · close structural",
      build: () => orbits(88, [{ x: 40, y: 30 }], 26), alt: 48,
    },
    {
      id: "msn-roof-7", name: "Substation Thermal Survey", type: "thermal",
      status: "complete", started: "2026-05-15T08:10:00.000Z", duration: 588,
      drone: { model: "Sentinel T2", serial: "ST2-7C13-4480" },
      site: { id: "site-demo-001", name: "Greenfield Solar" },
      cameraNote: "Nadir · radiometric IR",
      build: () => travelHeadings(serpentine(96, 8, 220, 200)), alt: 33,
    },
    {
      id: "msn-stock-8", name: "Stockpile Volume Mosaic", type: "mosaic",
      status: "complete", started: "2026-05-12T15:02:00.000Z", duration: 690,
      drone: { model: "Sentinel X1", serial: "SX1-9E07-1145" },
      site: { id: "site-demo-001", name: "Greenfield Solar" },
      cameraNote: "Nadir · photogrammetry overlap",
      build: () => travelHeadings(serpentine(118, 10, 260, 240)), alt: 60,
    },
  ];

  /* ---------- assemble full mission objects ---------- */

  function assemble(def) {
    const pattern = def.build();
    const cruise = def.alt;
    const waypoints = [];
    const captures = [];
    let wi = 0;

    // takeoff (dock, ground)
    waypoints.push({ index: wi++, ...SITE, alt: 0, heading: pattern[0].heading, hold_seconds: 4, kind: "takeoff", hasCapture: false });
    // climb
    waypoints.push({ index: wi++, ...SITE, alt: cruise, heading: pattern[0].heading, hold_seconds: 0, kind: "ascent", hasCapture: false });

    // photo stops
    let seq = 0;
    pattern.forEach((p) => {
      const ll = enu(p.x, p.y);
      const alt = r2(cruise + (Math.sin((p.x + p.y) * 0.05) * 1.5));
      const idx = wi++;
      waypoints.push({ index: idx, lat: r2(ll.lat * 1e6) / 1e6, lon: r2(ll.lon * 1e6) / 1e6, alt, heading: Math.round(p.heading), hold_seconds: 2, kind: "photo", hasCapture: true });
      seq++;
      captures.push({
        image_id: `${def.id}-img-${pad4(seq)}`,
        lat: Number(ll.lat.toFixed(6)), lon: Number(ll.lon.toFixed(6)),
        alt, heading: Math.round(p.heading), waypoint_index: idx, seq,
      });
    });

    // RTL ascend + land
    waypoints.push({ index: wi++, ...SITE, alt: cruise + 8, heading: 180, hold_seconds: 0, kind: "rtl", hasCapture: false });
    waypoints.push({ index: wi++, ...SITE, alt: 0, heading: 180, hold_seconds: 0, kind: "land", hasCapture: false });

    // normalized route preview for list thumbnails
    const xs = pattern.map((p) => p.x), ys = pattern.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
    const step = Math.max(1, Math.floor(pattern.length / 48));
    const preview = [];
    for (let i = 0; i < pattern.length; i += step) {
      preview.push([
        Number(((pattern[i].x - minX) / spanX).toFixed(3)),
        Number((1 - (pattern[i].y - minY) / spanY).toFixed(3)),
      ]);
    }

    const startedMs = Date.parse(def.started);
    const ended = new Date(startedMs + def.duration * 1000).toISOString();

    const summary = {
      id: def.id, name: def.name, type: def.type, status: def.status,
      started_at: def.started, ended_at: def.status === "aborted" ? ended : ended,
      duration_seconds: def.duration,
      site: { id: def.site.id, name: def.site.name, dock: { lat: SITE.lat, lon: SITE.lon } },
      drone: def.drone,
      waypoint_count: waypoints.length,
      capture_count: captures.length,
      cameraNote: def.cameraNote,
      abort_reason: def.abort_reason || null,
      preview,
    };

    return {
      summary,
      detail: { ...summary, waypoints, capture_count: captures.length },
      captures,
    };
  }

  const ALL = DEFS.map(assemble);
  const BY_ID = {};
  ALL.forEach((m) => (BY_ID[m.summary.id] = m));

  /* ---------- fake paginated API ---------- */
  function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

  const api = {
    async listMissions({ limit = 20, offset = 0 } = {}) {
      await delay(220);
      const items = ALL.map((m) => m.summary);
      return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
    },
    async getMission(id) {
      await delay(180);
      const m = BY_ID[id];
      if (!m) throw new Error("not found");
      return m.detail;
    },
    async getCaptures(id, { limit = 100, offset = 0 } = {}) {
      await delay(160);
      const m = BY_ID[id];
      const items = m ? m.captures : [];
      return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
    },
    // synchronous helpers for live-sim
    _raw: BY_ID,
    SITE,
  };

  window.MissionAPI = api;
})();
