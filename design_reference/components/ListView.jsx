/* Mission history list — paginated, searchable, aborted rows distinct */
(function () {
  const { useState, useEffect, useRef } = React;
  const PAGE = 6;

  function SkeletonRow() {
    return React.createElement("div", { className: "mrow", style: { pointerEvents: "none" } },
      React.createElement("div", { className: "route-thumb skel" }),
      React.createElement("div", null,
        React.createElement("div", { className: "skel", style: { height: 14, width: "60%", borderRadius: 4 } }),
        React.createElement("div", { className: "skel", style: { height: 10, width: "40%", borderRadius: 4, marginTop: 7 } })),
      React.createElement("div", { className: "skel", style: { height: 12, borderRadius: 4 } }),
      React.createElement("div", { className: "skel", style: { height: 12, borderRadius: 4 } }),
      React.createElement("div", { className: "skel", style: { height: 12, borderRadius: 4 } }),
      React.createElement("div", { className: "skel", style: { height: 12, borderRadius: 4 } }),
    );
  }

  function MissionRow({ m, onOpen }) {
    const { fmtDuration, fmtDate, fmtTime } = window.Fmt;
    return React.createElement("div", {
      className: "mrow" + (m.status === "aborted" ? " aborted" : ""),
      onClick: () => onOpen(m.id), role: "button", tabIndex: 0,
      onKeyDown: (e) => { if (e.key === "Enter") onOpen(m.id); },
    },
      React.createElement("div", { className: "route-thumb" },
        React.createElement(window.RouteGlyph, { preview: m.preview, aborted: m.status === "aborted" })),
      React.createElement("div", { className: "mrow-name" },
        React.createElement("div", { className: "nm" }, m.name),
        React.createElement("div", { className: "meta" },
          React.createElement(window.StatusPill, { status: m.status }),
          React.createElement("span", { className: "cam" }, m.cameraNote))),
      React.createElement("div", { className: "cell-drone" },
        React.createElement("div", { className: "model" }, m.drone.model),
        React.createElement("div", { className: "serial" }, m.drone.serial)),
      React.createElement("div", { className: "cell-num" },
        React.createElement("div", { className: "big" }, fmtDuration(m.duration_seconds)),
        React.createElement("div", { className: "small" }, "duration")),
      React.createElement("div", { className: "cell-num" },
        React.createElement("div", { className: "big" }, m.capture_count),
        React.createElement("div", { className: "small" }, "photos")),
      React.createElement("div", { className: "cell-when" },
        React.createElement("div", { className: "d" }, fmtDate(m.started_at)),
        React.createElement("div", { className: "t" }, fmtTime(m.started_at), " · ", m.waypoint_count, " wp")),
    );
  }

  function ListView({ onOpen, onPlan }) {
    const [all, setAll] = useState(null);
    const [page, setPage] = useState(0);
    const [q, setQ] = useState("");

    useEffect(() => {
      let alive = true;
      // fetch all summaries (paginate under the hood to prove the endpoint works)
      (async () => {
        const acc = [];
        let offset = 0, total = Infinity;
        while (offset < total) {
          const res = await window.MissionAPI.listMissions({ limit: 20, offset });
          total = res.total; acc.push(...res.items); offset += res.limit;
        }
        if (alive) setAll(acc);
      })();
      return () => { alive = false; };
    }, []);

    const filtered = all ? all.filter((m) =>
      !q || m.name.toLowerCase().includes(q.toLowerCase()) || m.drone.model.toLowerCase().includes(q.toLowerCase())
    ) : null;
    const pages = filtered ? Math.max(1, Math.ceil(filtered.length / PAGE)) : 1;
    const pageItems = filtered ? filtered.slice(page * PAGE, page * PAGE + PAGE) : [];
    useEffect(() => { setPage(0); }, [q]);

    const total = all ? all.length : 0;
    const aborted = all ? all.filter((m) => m.status === "aborted").length : 0;

    return React.createElement("div", { className: "view list-view" },
      React.createElement("div", { className: "list-head" },
        React.createElement("div", { className: "inner" },
          React.createElement("div", { className: "list-title-row" },
            React.createElement("div", null,
              React.createElement("div", { className: "eyebrow", style: { marginBottom: 8 } }, "Greenfield Solar · Site-Demo-001"),
              React.createElement("h1", { className: "list-h1" }, "Mission History"),
              React.createElement("div", { className: "list-sub" },
                all ? React.createElement(React.Fragment, null,
                  React.createElement("b", null, total), " missions logged",
                  aborted ? React.createElement(React.Fragment, null, " · ", React.createElement("span", { style: { color: "var(--danger)" } }, aborted + " aborted")) : null
                ) : "Loading…")),
            React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center" } },
              React.createElement("label", { className: "search" },
                React.createElement(window.Icon, { name: "search", size: 15 }),
                React.createElement("input", { placeholder: "Search missions…", value: q, onChange: (e) => setQ(e.target.value) })),
              React.createElement("button", { className: "btn btn-primary", onClick: onPlan },
                React.createElement(window.Icon, { name: "plan", size: 15 }), "Plan mission"))))),

      React.createElement("div", { className: "list-scroll scroll" },
        React.createElement("div", { className: "list-inner" },
          React.createElement("div", { className: "col-head" },
            React.createElement("span", null, "Route"),
            React.createElement("span", null, "Mission"),
            React.createElement("span", null, "Drone"),
            React.createElement("span", { className: "r" }, "Duration"),
            React.createElement("span", { className: "r" }, "Captures"),
            React.createElement("span", { className: "r" }, "Started")),
          React.createElement("div", { className: "rows" },
            !all ? Array.from({ length: 5 }).map((_, i) => React.createElement(SkeletonRow, { key: i }))
              : pageItems.length ? pageItems.map((m) => React.createElement(MissionRow, { key: m.id, m, onOpen }))
                : React.createElement("div", { className: "empty-state" },
                  React.createElement("div", { className: "ic" }, React.createElement(window.Icon, { name: "search", size: 22 })),
                  React.createElement("div", { style: { fontWeight: 600, color: "var(--t-mid)" } }, "No missions match “" + q + "”"),
                  React.createElement("div", { style: { marginTop: 4, fontSize: 13 } }, "Try a different drone model or mission name."))),

          filtered && filtered.length > PAGE ? React.createElement("div", { className: "pager" },
            React.createElement("div", { className: "info" }, "Showing ", page * PAGE + 1, "–", Math.min((page + 1) * PAGE, filtered.length), " of ", filtered.length),
            React.createElement("div", { className: "ctrls" },
              React.createElement("button", { className: "btn btn-icon", disabled: page === 0, onClick: () => setPage((p) => p - 1) }, React.createElement(window.Icon, { name: "chevL", size: 16 })),
              React.createElement("span", { className: "info", style: { minWidth: 54, textAlign: "center" } }, page + 1, " / ", pages),
              React.createElement("button", { className: "btn btn-icon", disabled: page >= pages - 1, onClick: () => setPage((p) => p + 1) }, React.createElement(window.Icon, { name: "chevR", size: 16 })))) : null)));
  }

  window.ListView = ListView;
})();
