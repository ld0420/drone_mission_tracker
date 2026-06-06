/* shared helpers + tiny presentational atoms */
(function () {
  function fmtDuration(s) {
    const m = Math.floor(s / 60), sec = s % 60;
    if (m >= 60) { const h = Math.floor(m / 60); return `${h}h ${m % 60}m`; }
    return `${m}m ${String(sec).padStart(2, "0")}s`;
  }
  function fmtDurationLong(s) {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }
  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  function fmtDateTime(iso) {
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  }
  function relTime(iso) {
    const diff = (Date.now() - new Date(iso)) / 1000;
    const day = 86400;
    if (diff < day) return "today";
    if (diff < 2 * day) return "yesterday";
    return `${Math.floor(diff / day)}d ago`;
  }
  function compass(deg) {
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round(deg / 45) % 8];
  }

  // tiny SVG glyph of a flight pattern from normalized [x,y] points
  function RouteGlyph({ preview, aborted }) {
    if (!preview || !preview.length) return null;
    const W = 64, H = 44, pad = 6;
    const pts = preview.map(([x, y]) => [pad + x * (W - pad * 2), pad + y * (H - pad * 2)]);
    const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const col = aborted ? "#ff6b5e" : "#4fe3a1";
    return React.createElement("svg", { viewBox: `0 0 ${W} ${H}` },
      React.createElement("path", { d, fill: "none", stroke: col, strokeWidth: 1.3, strokeOpacity: 0.85, strokeLinejoin: "round", strokeLinecap: "round" }),
      React.createElement("circle", { cx: pts[0][0], cy: pts[0][1], r: 1.8, fill: col }),
      React.createElement("circle", { cx: pts[pts.length - 1][0], cy: pts[pts.length - 1][1], r: 1.8, fill: aborted ? "#ff6b5e" : "#fff" })
    );
  }

  function StatusPill({ status }) {
    const map = { complete: "complete", aborted: "aborted", live: "live" };
    const label = { complete: "Complete", aborted: "Aborted", live: "Live" };
    const cls = map[status] || "complete";
    return React.createElement("span", { className: "pill " + cls },
      React.createElement("span", { className: "dot" }), label[status] || status);
  }

  window.Fmt = { fmtDuration, fmtDurationLong, fmtDate, fmtTime, fmtDateTime, relTime, compass };
  window.RouteGlyph = RouteGlyph;
  window.StatusPill = StatusPill;
})();
