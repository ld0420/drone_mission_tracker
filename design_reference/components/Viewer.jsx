/* Fullscreen capture viewer — keyboard / button / swipe nav, filmstrip */
(function () {
  const { useEffect, useRef, useState } = React;

  function Viewer({ captures, seq, missionType, missionName, onSeq, onClose }) {
    const idx = captures.findIndex((c) => c.seq === seq);
    const cap = captures[idx];
    const [swap, setSwap] = useState(false);
    const filmRef = useRef(null);
    const touch = useRef(null);

    const go = (d) => {
      const ni = idx + d;
      if (ni < 0 || ni >= captures.length) return;
      onSeq(captures[ni].seq);
    };

    useEffect(() => {
      const onKey = (e) => {
        if (e.key === "ArrowRight") go(1);
        else if (e.key === "ArrowLeft") go(-1);
        else if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    });

    useEffect(() => {
      setSwap(true);
      const t = setTimeout(() => setSwap(false), 300);
      // keep active filmstrip thumb in view
      const film = filmRef.current;
      if (film) {
        const el = film.querySelector(`.film-thumb[data-i="${idx}"]`);
        if (el) film.scrollTo({ left: el.offsetLeft - film.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
      }
      return () => clearTimeout(t);
    }, [idx]);

    if (!cap) return null;
    const { compass } = window.Fmt;
    const src = window.CaptureImages.get(missionType, cap.image_id);

    return React.createElement("div", { className: "viewer",
      onTouchStart: (e) => (touch.current = e.touches[0].clientX),
      onTouchEnd: (e) => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touch.current = null; } },
      React.createElement("div", { className: "viewer-top" },
        React.createElement("div", { className: "meta" },
          React.createElement("button", { className: "vnav", style: { position: "static", width: 38, height: 38, transform: "none" }, onClick: onClose },
            React.createElement(window.Icon, { name: "close", size: 18 })),
          React.createElement("div", null,
            React.createElement("div", { style: { fontWeight: 700, fontSize: 14 } }, missionName),
            React.createElement("div", { className: "viewer-seq" }, "Capture ", React.createElement("b", null, cap.seq), " of ", captures.length))),
        React.createElement("div", { className: "viewer-seq mono", style: { fontSize: 12 } }, cap.image_id)),

      React.createElement("div", { className: "viewer-stage" },
        React.createElement("button", { className: "vnav prev", onClick: () => go(-1), disabled: idx === 0 }, React.createElement(window.Icon, { name: "chevL", size: 22 })),
        React.createElement("div", { className: "viewer-img-wrap" },
          React.createElement("img", { className: "viewer-img" + (swap ? " swap" : ""), src, key: cap.image_id, alt: "capture " + cap.seq, draggable: false }),
          React.createElement("div", { className: "viewer-overlay-info" },
            React.createElement("span", { className: "vchip" }, React.createElement(window.Icon, { name: "camera", size: 12, style: { color: "var(--acc)" } }), "HDG ", React.createElement("span", { className: "acc" }, cap.heading, "° ", compass(cap.heading))),
            React.createElement("span", { className: "vchip" }, "ALT ", cap.alt, " m"),
            React.createElement("span", { className: "vchip" }, "WP ", cap.waypoint_index),
            React.createElement("span", { className: "vchip" }, cap.lat.toFixed(5), ", ", cap.lon.toFixed(5)))),
        React.createElement("button", { className: "vnav next", onClick: () => go(1), disabled: idx === captures.length - 1 }, React.createElement(window.Icon, { name: "chevR", size: 22 }))),

      React.createElement("div", { className: "viewer-film scroll", ref: filmRef },
        captures.map((c, i) => React.createElement("div", {
          key: c.image_id, "data-i": i, className: "film-thumb" + (i === idx ? " active" : ""),
          onClick: () => onSeq(c.seq),
        }, Math.abs(i - idx) < 22
          ? React.createElement("img", { src: window.CaptureImages.get(missionType, c.image_id), alt: "", draggable: false })
          : React.createElement("div", { className: "skel", style: { width: "100%", height: "100%" } })))));
  }

  window.Viewer = Viewer;
})();
