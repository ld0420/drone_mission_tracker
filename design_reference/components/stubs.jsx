/* temporary stubs — replaced by real Chat/Live components */
(function () {
  function Stub({ title }) {
    return React.createElement("div", { className: "view", style: { display: "grid", placeItems: "center", color: "var(--t-lo)" } }, title + " — building…");
  }
  window.PlanView = window.PlanView || function (p) { return React.createElement(Stub, { title: "Plan" }); };
  window.LiveView = window.LiveView || function (p) { return React.createElement(Stub, { title: "Live" }); };
})();
