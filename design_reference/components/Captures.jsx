/* Captures rail — scroll-driven lazy reveal + seq numbers + progress.
   (Scroll windowing instead of IntersectionObserver: IO callbacks don't
    fire in the preview sandbox; scroll-reveal is the robust equivalent
    and still avoids generating 190 thumbnails up front.) */
(function () {
  const { useState, useEffect, useRef } = React;

  function Thumb({ cap, missionType, selected, eager, onOpen }) {
    const [loaded, setLoaded] = useState(false);
    const src = eager ? window.CaptureImages.get(missionType, cap.image_id) : null;
    return React.createElement("div", {
      className: "thumb" + (selected ? " selected" : ""), tabIndex: 0, role: "button",
      "data-seq": cap.seq, onClick: () => onOpen(cap.seq),
      onKeyDown: (e) => { if (e.key === "Enter") onOpen(cap.seq); },
    },
      src ? React.createElement("img", { src, className: loaded ? "loaded" : "", onLoad: () => setLoaded(true), alt: "capture " + cap.seq, draggable: false })
        : React.createElement("div", { className: "thumb-shimmer skel" }),
      React.createElement("span", { className: "seq" }, cap.seq),
      React.createElement("span", { className: "hd" }, React.createElement(window.Icon, { name: "camera", size: 12 })));
  }

  function CapturesRail({ captures, total, loaded, selectedSeq, missionType, onOpen }) {
    const scrollRef = useRef(null);
    const [reveal, setReveal] = useState(30);

    const onScroll = (e) => {
      const el = e.currentTarget;
      if (el.scrollTop + el.clientHeight > el.scrollHeight - 360) {
        setReveal((r) => Math.min(Math.max(total, captures.length), r + 24));
      }
    };

    useEffect(() => {
      if (selectedSeq == null) return;
      const idx = captures.findIndex((c) => c.seq === selectedSeq);
      if (idx < 0) return;
      setReveal((r) => Math.max(r, idx + 12));
      const cont = scrollRef.current; if (!cont) return;
      requestAnimationFrame(() => {
        const el = cont.querySelector(`.thumb[data-seq="${selectedSeq}"]`);
        if (el) cont.scrollTo({ top: Math.max(0, el.offsetTop - cont.clientHeight / 2 + el.clientHeight / 2), behavior: "smooth" });
      });
    }, [selectedSeq, captures]);

    const pct = total ? Math.round((loaded / total) * 100) : 0;
    return React.createElement("aside", { className: "cap-rail" },
      React.createElement("div", { className: "cap-head" },
        React.createElement("div", { className: "cap-head-top" },
          React.createElement("h3", null, "Captures"),
          React.createElement("span", { className: "count" }, total)),
        React.createElement("div", { className: "cap-progress" }, React.createElement("i", { style: { width: pct + "%" } })),
        React.createElement("div", { className: "cap-progress-label" },
          React.createElement("span", null, loaded < total ? "Indexing captures…" : "All captures indexed"),
          React.createElement("span", null, loaded, " / ", total))),
      React.createElement("div", { className: "cap-grid scroll", ref: scrollRef, onScroll },
        captures.map((c, i) => React.createElement(Thumb, {
          key: c.image_id, cap: c, missionType, eager: i < reveal,
          selected: c.seq === selectedSeq, onOpen,
        })),
        loaded < total ? Array.from({ length: Math.min(6, total - loaded) }).map((_, i) =>
          React.createElement("div", { key: "s" + i, className: "thumb-skel skel" })) : null));
  }

  window.CapturesRail = CapturesRail;
})();
