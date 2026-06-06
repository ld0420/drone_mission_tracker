/* Detail view — map + metadata + captures rail + viewer, wired in sync */
(function () {
  const { useState, useEffect, useRef } = React;

  function MetaCell({ k, v, mono }) {
    return React.createElement("div", { className: "meta-cell" },
      React.createElement("div", { className: "k" }, k),
      React.createElement("div", { className: "v" + (mono ? " mono" : "") }, v));
  }

  function DetailView({ missionId, onBack }) {
    const [mission, setMission] = useState(null);
    const [captures, setCaptures] = useState([]);
    const [total, setTotal] = useState(0);
    const [selectedSeq, setSelectedSeq] = useState(null);
    const [viewerOpen, setViewerOpen] = useState(false);
    const mapRef = useRef(null);
    const { fmtDuration, fmtDateTime, fmtTime, fmtDate } = window.Fmt;

    useEffect(() => {
      let alive = true;
      setMission(null); setCaptures([]); setTotal(0); setSelectedSeq(null); setViewerOpen(false);
      window.MissionAPI.getMission(missionId).then((m) => { if (alive) setMission(m); });
      (async () => {
        let offset = 0, tot = Infinity; const acc = [];
        while (offset < tot) {
          const res = await window.MissionAPI.getCaptures(missionId, { limit: 100, offset });
          if (!alive) return;
          tot = res.total; acc.push(...res.items); offset += res.limit;
          setCaptures(acc.slice()); setTotal(tot);
          await new Promise((r) => setTimeout(r, 150));
        }
      })();
      return () => { alive = false; };
    }, [missionId]);

    const select = (seq) => { setSelectedSeq(seq); setViewerOpen(true); };

    const planned = mission ? {
      path: mission.waypoints.map((w) => [w.lon, w.lat]),
      dock: [mission.site.dock.lon, mission.site.dock.lat],
      status: mission.status,
    } : null;
    const aborted = mission && mission.status === "aborted";

    return React.createElement("div", { className: "view detail" },
      React.createElement("div", { className: "detail-map" },
        planned ? React.createElement(window.MapView, {
          ref: mapRef, planned, captures, selectedSeq, mode: "detail",
          onSelectCapture: (seq) => select(seq),
        }) : React.createElement("div", { style: { position: "absolute", inset: 0, display: "grid", placeItems: "center" } }, React.createElement("div", { className: "spin" })),

        React.createElement("div", { className: "detail-topbar" },
          React.createElement("button", { className: "back-btn", onClick: onBack },
            React.createElement(window.Icon, { name: "chevL", size: 16 }), "Missions"),
          mission ? React.createElement("div", { className: "detail-titlewrap" },
            React.createElement("div", { className: "nm" }, mission.name),
            React.createElement("div", { className: "sub" },
              React.createElement(window.StatusPill, { status: mission.status }),
              React.createElement("span", { className: "tag" }, mission.type))) : null),

        mission ? React.createElement("div", { className: "legend" },
          React.createElement("div", { className: "row" },
            React.createElement("span", { className: "gl" }, React.createElement("svg", { width: 16, height: 10 }, React.createElement("line", { x1: 0, y1: 5, x2: 16, y2: 5, stroke: aborted ? "#ff6b5e" : "#4fe3a1", strokeWidth: 2 }))),
            "Planned flight path"),
          React.createElement("div", { className: "row" },
            React.createElement("span", { className: "gl" }, React.createElement("svg", { width: 14, height: 12, viewBox: "0 0 14 12" }, React.createElement("path", { d: "M7 11 L2 2 L12 2 Z", fill: "rgba(79,227,161,0.3)", stroke: "#4fe3a1" }))),
            "Capture · camera heading"),
          React.createElement("div", { className: "row" },
            React.createElement("span", { className: "gl" }, React.createElement(window.Icon, { name: "home", size: 13, style: { color: "#fff" } })),
            "Dock · takeoff & RTL")) : null,

        mission ? React.createElement("div", { className: "meta-card" },
          React.createElement("div", { className: "meta-card-head" },
            React.createElement("span", { className: "eyebrow" }, "Mission Telemetry"),
            React.createElement("span", { className: "tag" }, mission.id)),
          React.createElement("div", { className: "meta-grid" },
            React.createElement(MetaCell, { k: "Drone", v: mission.drone.model }),
            React.createElement(MetaCell, { k: "Serial", v: mission.drone.serial, mono: true }),
            React.createElement(MetaCell, { k: "Duration", v: fmtDuration(mission.duration_seconds), mono: true }),
            React.createElement(MetaCell, { k: "Captures", v: mission.capture_count + " / " + mission.waypoint_count + " wp", mono: true }),
            React.createElement(MetaCell, { k: "Started", v: fmtDate(mission.started_at) + " · " + fmtTime(mission.started_at), mono: true }),
            React.createElement(MetaCell, { k: "Ended", v: fmtTime(mission.ended_at), mono: true })),
          aborted ? React.createElement("div", { className: "abort-banner" },
            React.createElement("span", { className: "ic" }, React.createElement(window.Icon, { name: "alert", size: 16 })),
            React.createElement("div", null,
              React.createElement("b", null, "Mission aborted"),
              mission.abort_reason)) : null) : null),

      React.createElement(window.CapturesRail, {
        captures, total, loaded: captures.length, selectedSeq,
        missionType: mission ? mission.type : "inspection", onOpen: select,
      }),

      viewerOpen && mission ? React.createElement(window.Viewer, {
        captures, seq: selectedSeq, missionType: mission.type, missionName: mission.name,
        onSeq: (s) => setSelectedSeq(s), onClose: () => setViewerOpen(false),
      }) : null);
  }

  window.DetailView = DetailView;
})();
