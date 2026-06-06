/* ===================================================================
   LiveView — watch a live mission. Simulates the SSE stream from the
   mock mission data: telemetry @ ~5Hz, image_captured events, and a
   terminal mission_complete / mission_aborted. Map updates imperatively
   every frame; the HUD re-renders on a throttled cadence.
   =================================================================== */
(function () {
  const { useState, useEffect, useRef } = React;

  function haversine(a, b) {
    const R = 6371000, toR = Math.PI / 180;
    const dLat = (b[1] - a[1]) * toR, dLon = (b[0] - a[0]) * toR;
    const la1 = a[1] * toR, la2 = b[1] * toR;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function LiveView({ runId, templateId, onDone, onReplan }) {
    const [mission, setMission] = useState(null);
    const [telem, setTelem] = useState({ battery: 100, alt: 0, signal: 0, heading: 0, elapsed: 0 });
    const [status, setStatus] = useState("init");
    const [recent, setRecent] = useState([]);
    const [follow, setFollow] = useState(false);
    const [summary, setSummary] = useState(null);
    const [viewerSeq, setViewerSeq] = useState(null);
    const mapRef = useRef(null);
    const mapReady = useRef(false);
    const timer = useRef(0);
    const started = useRef(false);
    const dataRef = useRef(null);
    const { fmtDurationLong, compass } = window.Fmt;

    const speed = (() => { try { return JSON.parse(sessionStorage.getItem("launch")).speed || 6; } catch (e) { return 6; } })();
    const tplId = templateId || "msn-grid-1";

    useEffect(() => {
      const raw = window.MissionAPI._raw[tplId];
      if (!raw) return;
      dataRef.current = { mission: raw.detail, captures: raw.captures };
      setMission(raw.detail);
      return () => clearInterval(timer.current);
      // eslint-disable-next-line
    }, [tplId]);

    const tryStart = () => {
      if (started.current || !dataRef.current || !mapReady.current) return;
      started.current = true;
      setStatus("flying");
      const { mission: m, captures } = dataRef.current;
      const wps = m.waypoints, N = wps.length, dur = m.duration_seconds;
      const aborted = m.status === "aborted";
      const endBatt = aborted ? 16 : 27;
      const capByWp = {}; captures.forEach((c) => (capByWp[c.waypoint_index] = c));

      const t0 = performance.now();
      let lastHud = 0, lastTrail = 0, emitted = 0, dist = 0, lastPt = null, capCount = 0;
      const trail = [];
      let totalDist = 0;
      for (let k = 0; k < N - 1; k++) totalDist += haversine([wps[k].lon, wps[k].lat], [wps[k + 1].lon, wps[k + 1].lat]);

      const frame = () => {
        const now = performance.now();
        const simEl = ((now - t0) / 1000) * speed;
        const progress = Math.min(1, simEl / dur);
        const f = progress * (N - 1), i = Math.floor(f), tt = f - i;
        const a = wps[i], b = wps[Math.min(N - 1, i + 1)];
        const lon = a.lon + (b.lon - a.lon) * tt, lat = a.lat + (b.lat - a.lat) * tt;
        const alt = a.alt + (b.alt - a.alt) * tt;
        const heading = a.heading;
        mapRef.current.setDrone({ lon, lat, heading });

        if (now - lastTrail > 160) {
          trail.push([lon, lat]); mapRef.current.setTrail(trail);
          if (lastPt) dist += haversine(lastPt, [lon, lat]);
          lastPt = [lon, lat]; lastTrail = now;
        }
        while (emitted <= i) {
          const c = capByWp[wps[emitted] && wps[emitted].index];
          if (c) { capCount++; mapRef.current.addCapture(c); setRecent((r) => [...r, c]); }
          emitted++;
        }
        if (now - lastHud > 120) {
          setTelem({
            battery: Math.max(endBatt, 100 - progress * (100 - endBatt)),
            alt: Math.round(alt),
            signal: Math.round(76 + Math.sin(now / 700) * 7 + Math.random() * 3),
            heading: Math.round(heading), elapsed: simEl,
          });
          lastHud = now;
        }
        if (progress >= 1) {
          mapRef.current.setDrone({ lon: b.lon, lat: b.lat, heading });
          clearInterval(timer.current);
          setStatus(aborted ? "aborted" : "complete");
          setSummary({ captures: capCount, distance: totalDist, duration: simEl, aborted, reason: m.abort_reason });
          return;
        }
      };
      timer.current = setInterval(frame, 1000 / 60);
    };

    const onMapReady = () => { mapReady.current = true; tryStart(); };
    useEffect(() => { if (mission && mapReady.current) tryStart(); /* eslint-disable-next-line */ }, [mission]);

    useEffect(() => { if (mapRef.current) mapRef.current.resize(); }, []);

    const planned = mission ? { path: mission.waypoints.map((w) => [w.lon, w.lat]), dock: [mission.site.dock.lon, mission.site.dock.lat], status: "live" } : null;
    const latest = recent[recent.length - 1];
    const battColor = telem.battery > 40 ? "var(--acc)" : telem.battery > 20 ? "var(--warn)" : "var(--danger)";

    return React.createElement("div", { className: "view live" },
      React.createElement("div", { className: "live-map" },
        planned ? React.createElement(window.MapView, { ref: mapRef, planned, captures: [], mode: "live", follow, onReady: onMapReady }) : null,

        // top bar
        React.createElement("div", { className: "live-topbar" },
          React.createElement("div", { className: "live-top-l" },
            React.createElement("span", { className: "pill live" }, React.createElement("span", { className: "dot" }), status === "flying" ? "Live" : status === "aborted" ? "Aborted" : "Complete"),
            React.createElement("div", null,
              React.createElement("div", { className: "live-name" }, mission ? mission.name : "—"),
              React.createElement("div", { className: "live-run mono" }, runId))),
          React.createElement("div", { className: "live-top-r" },
            React.createElement("div", { className: "elapsed mono" }, fmtDurationLong(Math.floor(telem.elapsed))),
            React.createElement("span", { className: "tag" }, speed, "× replay"),
            React.createElement("button", { className: "btn btn-icon" + (follow ? " btn-primary" : ""), title: "Follow drone", onClick: () => setFollow((v) => !v) }, React.createElement(window.Icon, { name: "crosshair", size: 16 })),
            React.createElement("button", { className: "btn btn-ghost", onClick: onDone }, "Exit"))),

        // HUD instrument strip
        mission ? React.createElement("div", { className: "hud" },
          React.createElement(Instrument, { icon: "battery", label: "Battery", value: Math.round(telem.battery) + "%", color: battColor, bar: telem.battery }),
          React.createElement(Instrument, { icon: "arrowUp", label: "Altitude", value: telem.alt + " m" }),
          React.createElement(Instrument, { icon: "signal", label: "Signal", value: telem.signal + "%" }),
          React.createElement(Instrument, { icon: "gauge", label: "Heading", value: telem.heading + "° " + compass(telem.heading) }),
          React.createElement(Instrument, { icon: "camera", label: "Captured", value: String(recent.length), accent: true })) : null,

        // capture pop
        latest ? React.createElement("div", { className: "cap-pop", key: latest.seq, onClick: () => setViewerSeq(latest.seq) },
          React.createElement("div", { className: "cap-pop-img" },
            React.createElement("img", { src: window.CaptureImages.get(mission.type, latest.image_id), alt: "" }),
            React.createElement("span", { className: "cap-pop-seq" }, "#", latest.seq)),
          React.createElement("div", { className: "cap-pop-meta" },
            React.createElement("div", { className: "eyebrow" }, "New capture"),
            React.createElement("div", { className: "cap-pop-hd mono" }, "HDG ", latest.heading, "° · ALT ", latest.alt, "m"),
            React.createElement("div", { className: "cap-pop-strip" },
              recent.slice(-5).reverse().map((c) => React.createElement("img", { key: c.image_id, src: window.CaptureImages.get(mission.type, c.image_id), alt: "" }))))) : null,

        // terminal summary
        summary ? React.createElement(Summary, { summary, mission, onDone, onReplan, fmt: window.Fmt }) : null),

      viewerSeq != null && mission ? React.createElement(window.Viewer, {
        captures: recent, seq: viewerSeq, missionType: mission.type, missionName: mission.name,
        onSeq: setViewerSeq, onClose: () => setViewerSeq(null),
      }) : null);
  }

  function Instrument({ icon, label, value, color, bar, accent }) {
    return React.createElement("div", { className: "instr" },
      React.createElement("div", { className: "instr-ic", style: accent ? { color: "var(--acc)" } : null }, React.createElement(window.Icon, { name: icon, size: 15 })),
      React.createElement("div", null,
        React.createElement("div", { className: "instr-label" }, label),
        React.createElement("div", { className: "instr-val mono", style: color ? { color } : null }, value),
        bar != null ? React.createElement("div", { className: "instr-bar" }, React.createElement("i", { style: { width: bar + "%", background: color } })) : null));
  }

  function Summary({ summary, mission, onDone, onReplan, fmt }) {
    const ab = summary.aborted;
    return React.createElement("div", { className: "live-summary-wrap" },
      React.createElement("div", { className: "live-summary" + (ab ? " aborted" : "") },
        React.createElement("div", { className: "ls-icon" }, React.createElement(window.Icon, { name: ab ? "alert" : "check", size: 24 })),
        React.createElement("div", { className: "ls-title" }, ab ? "Mission aborted" : "Mission complete"),
        React.createElement("div", { className: "ls-sub" }, mission.name),
        ab ? React.createElement("div", { className: "ls-reason" }, React.createElement(window.Icon, { name: "alert", size: 14 }), summary.reason) : null,
        React.createElement("div", { className: "ls-stats" },
          React.createElement(Stat, { k: "Flight time", v: fmt.fmtDuration(Math.round(summary.duration)) }),
          React.createElement(Stat, { k: "Captures", v: summary.captures }),
          React.createElement(Stat, { k: "Distance", v: (summary.distance / 1000).toFixed(2) + " km" })),
        React.createElement("div", { className: "ls-actions" },
          React.createElement("button", { className: "btn", onClick: onReplan }, "Plan another"),
          React.createElement("button", { className: "btn btn-primary", onClick: onDone }, "View in history"))));
  }
  function Stat({ k, v }) {
    return React.createElement("div", { className: "ls-stat" },
      React.createElement("div", { className: "ls-stat-v num" }, v),
      React.createElement("div", { className: "ls-stat-k" }, k));
  }

  window.LiveView = LiveView;
})();
