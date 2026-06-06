/* App root — rail nav + hash routing */
(function () {
  const { useState, useEffect } = React;

  function parseHash() {
    const h = (window.location.hash || "#/missions").replace(/^#/, "");
    const parts = h.split("/").filter(Boolean);
    if (parts[0] === "missions" && parts[1]) return { view: "detail", id: parts[1] };
    if (parts[0] === "plan") return { view: "plan" };
    if (parts[0] === "live") return { view: "live", runId: parts[1] || null, template: parts[2] || null };
    return { view: "list" };
  }
  function nav(hash) { window.location.hash = hash; }

  function Rail({ route }) {
    const items = [
      { key: "list", icon: "grid", hash: "#/missions", label: "History", active: route.view === "list" || route.view === "detail" },
      { key: "plan", icon: "plan", hash: "#/plan", label: "Plan", active: route.view === "plan" },
      { key: "live", icon: "live", hash: route.runId ? "#/live/" + route.runId : "#/plan", label: "Live", active: route.view === "live" },
    ];
    return React.createElement("nav", { className: "rail" },
      React.createElement("div", { className: "rail-logo", title: "Mission Tracker" },
        React.createElement(window.Icon, { name: "drone", size: 17, stroke: 2 })),
      items.map((it) => React.createElement("button", {
        key: it.key, className: "rail-btn" + (it.active ? " active" : ""), title: it.label,
        onClick: () => nav(it.hash),
      }, React.createElement(window.Icon, { name: it.icon, size: 19 }))),
      React.createElement("div", { className: "rail-spacer" }),
      React.createElement("button", { className: "rail-btn", title: "Settings" }, React.createElement(window.Icon, { name: "settings", size: 18 })));
  }

  function App() {
    const [route, setRoute] = useState(parseHash());
    useEffect(() => {
      const on = () => setRoute(parseHash());
      window.addEventListener("hashchange", on);
      return () => window.removeEventListener("hashchange", on);
    }, []);

    let body;
    if (route.view === "detail") body = React.createElement(window.DetailView, { key: route.id, missionId: route.id, onBack: () => nav("#/missions") });
    else if (route.view === "plan") body = React.createElement(window.PlanView, { onLaunch: (runId, tpl) => nav("#/live/" + runId + (tpl ? "/" + tpl : "")) });
    else if (route.view === "live") body = React.createElement(window.LiveView, { key: route.runId, runId: route.runId, templateId: route.template, onDone: () => nav("#/missions"), onReplan: () => nav("#/plan") });
    else body = React.createElement(window.ListView, { onOpen: (id) => nav("#/missions/" + id), onPlan: () => nav("#/plan") });

    return React.createElement("div", { className: "app" },
      React.createElement(Rail, { route }),
      React.createElement("main", { className: "main" }, body));
  }

  window.__App = App;
})();
