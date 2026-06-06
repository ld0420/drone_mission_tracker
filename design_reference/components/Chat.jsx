/* ===================================================================
   PlanView — chat-style mission planning. Scripted finite-state flow
   (no real LLM): pick mission type → confirm site → review plan →
   pre-flight checklist → Start Mission (the terminal action, in-chat).
   =================================================================== */
(function () {
  const { useState, useRef, useEffect } = React;

  const TEMPLATES = {
    inspection: { id: "msn-grid-1", label: "Solar Array Grid Inspection", drone: "Sentinel X1", serial: "SX1-A4F2-9921", pattern: "S-pattern nadir grid", alt: 35, wp: 148, cap: 144, est: "12m 31s", camera: "Nadir RGB + IR" },
    patrol: { id: "msn-patrol-2", label: "Perimeter Security Patrol", drone: "Sentinel X1", serial: "SX1-A4F2-9921", pattern: "Outward-facing loop", alt: 42, wp: 126, cap: 122, est: "10m 42s", camera: "Outward RGB" },
    thermal: { id: "msn-thermal-3", label: "Thermal Anomaly Sweep", drone: "Sentinel T2", serial: "ST2-7C13-4480", pattern: "Inward hot-spot orbits", alt: 55, wp: 144, cap: 140, est: "13m 38s", camera: "Radiometric IR" },
  };
  const TYPE_CHIPS = [
    { label: "Inspection grid", value: "inspection" },
    { label: "Security patrol", value: "patrol" },
    { label: "Thermal sweep", value: "thermal" },
  ];

  function PlanView({ onLaunch }) {
    const [msgs, setMsgs] = useState([]);
    const [chips, setChips] = useState([]);
    const [typing, setTyping] = useState(false);
    const [speed, setSpeed] = useState(6);
    const [checks, setChecks] = useState(0);
    const [launching, setLaunching] = useState(false);
    const stage = useRef("boot");
    const plan = useRef({ type: null, t: null, alt: null });
    const scrollRef = useRef(null);
    const idc = useRef(0);

    const down = () => requestAnimationFrame(() => { const s = scrollRef.current; if (s) s.scrollTo({ top: s.scrollHeight, behavior: "smooth" }); });
    const addMsg = (m) => { setMsgs((x) => [...x, { id: idc.current++, ...m }]); down(); };

    const sysSay = (payload, after, delay = 750) => {
      setTyping(true); setChips([]); down();
      setTimeout(() => { setTyping(false); addMsg({ role: "sys", ...payload }); if (after) after(); }, delay);
    };

    // boot conversation
    useEffect(() => {
      const t1 = setTimeout(() => {
        addMsg({ role: "sys", text: "Operator online. I'll help you set up a flight at Greenfield Solar. What kind of mission are we flying today?" });
        stage.current = "type"; setChips(TYPE_CHIPS);
      }, 500);
      return () => clearTimeout(t1);
      // eslint-disable-next-line
    }, []);

    const proposePlan = () => {
      const t = plan.current.t;
      const alt = plan.current.alt || t.alt;
      sysSay({
        text: `Here's the plan. ${t.label.split(" ").slice(0, 3).join(" ")} flies a ${t.pattern.toLowerCase()} at ${alt} m AGL on the ${t.drone}.`,
        card: { kind: "plan", t, alt },
      }, () => { stage.current = "review"; setChips([{ label: "Looks good — arm it", value: "arm" }, { label: "Adjust altitude", value: "alt" }]); });
    };

    const armUp = () => {
      sysSay({ text: "Pre-flight checks running…", card: { kind: "arm" } }, () => {
        stage.current = "armed"; setChips([]);
        setChecks(0);
        [1, 2, 3, 4].forEach((n) => setTimeout(() => setChecks(n), 500 * n));
      }, 700);
    };

    const onChip = (chip) => {
      const s = stage.current;
      if (s === "type") {
        const t = TEMPLATES[chip.value];
        plan.current = { type: chip.value, t, alt: null };
        addMsg({ role: "op", text: chip.label });
        sysSay({ text: `Good copy — ${t.label}. Launch point is the active dock at Greenfield Solar. Camera: ${t.camera}. Want me to draft the plan?` },
          () => { stage.current = "site"; setChips([{ label: "Draft the plan", value: "draft" }, { label: "Pick another type", value: "back" }]); });
      } else if (s === "site") {
        addMsg({ role: "op", text: chip.label });
        if (chip.value === "back") { sysSay({ text: "No problem. What are we flying instead?" }, () => { stage.current = "type"; setChips(TYPE_CHIPS); }); }
        else proposePlan();
      } else if (s === "review") {
        addMsg({ role: "op", text: chip.label });
        if (chip.value === "arm") armUp();
        else sysSay({ text: "Sure — what cruise altitude do you want?" }, () => { stage.current = "alt"; setChips([{ label: "25 m", value: "25" }, { label: "35 m", value: "35" }, { label: "45 m", value: "45" }, { label: "60 m", value: "60" }]); });
      } else if (s === "alt") {
        plan.current.alt = parseInt(chip.value, 10);
        addMsg({ role: "op", text: chip.label + " AGL" });
        proposePlan();
      }
    };

    const start = () => {
      const t = plan.current.t;
      setLaunching(true); setChips([]);
      addMsg({ role: "op", text: "Start mission" });
      sysSay({ text: `Arming ${t.drone} and uploading ${t.wp} waypoints… you have the aircraft.` }, () => {
        // mock POST /api/missions/start
        const run_id = "run-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
        try { sessionStorage.setItem("launch", JSON.stringify({ templateId: t.id, speed })); } catch (e) {}
        setTimeout(() => onLaunch(run_id, t.id), 900);
      }, 850);
    };

    return React.createElement("div", { className: "view plan-view" },
      React.createElement("div", { className: "plan-head" },
        React.createElement("div", { className: "plan-head-l" },
          React.createElement("div", { className: "plan-avatar" }, React.createElement(window.Icon, { name: "drone", size: 16 })),
          React.createElement("div", null,
            React.createElement("div", { className: "plan-title" }, "Mission Planner"),
            React.createElement("div", { className: "plan-status" }, React.createElement("span", { className: "lampe" }), "Greenfield Solar · dock online"))),
        React.createElement("button", { className: "btn btn-ghost", onClick: () => (window.location.hash = "#/missions") }, "Cancel")),

      React.createElement("div", { className: "chat-scroll scroll", ref: scrollRef },
        React.createElement("div", { className: "chat-inner" },
          msgs.map((m) => React.createElement(Bubble, { key: m.id, m, speed, setSpeed, checks, onStart: start, launching })),
          typing ? React.createElement("div", { className: "bubble sys" },
            React.createElement("div", { className: "av" }, React.createElement(window.Icon, { name: "drone", size: 13 })),
            React.createElement("div", { className: "typing" }, React.createElement("span", null), React.createElement("span", null), React.createElement("span", null))) : null)),

      React.createElement("div", { className: "chat-dock" },
        React.createElement("div", { className: "chat-inner" },
          chips.length ? React.createElement("div", { className: "chips" },
            chips.map((c) => React.createElement("button", { key: c.value, className: "chip", onClick: () => onChip(c) }, c.label))) : null,
          React.createElement("div", { className: "composer" + (chips.length || typing ? " muted" : "") },
            React.createElement("input", { placeholder: chips.length ? "Tap a suggestion above…" : "Conversation guided — pick an option", disabled: true }),
            React.createElement("button", { className: "composer-send", disabled: true }, React.createElement(window.Icon, { name: "send", size: 16 }))))));
  }

  function Bubble({ m, speed, setSpeed, checks, onStart, launching }) {
    if (m.role === "op") return React.createElement("div", { className: "bubble op" }, React.createElement("div", { className: "bub" }, m.text));
    return React.createElement("div", { className: "bubble sys" },
      React.createElement("div", { className: "av" }, React.createElement(window.Icon, { name: "drone", size: 13 })),
      React.createElement("div", { className: "bub-wrap" },
        m.text ? React.createElement("div", { className: "bub" }, m.text) : null,
        m.card ? React.createElement(Card, { card: m.card, speed, setSpeed, checks, onStart, launching }) : null));
  }

  function Card({ card, speed, setSpeed, checks, onStart, launching }) {
    if (card.kind === "plan") {
      const { t, alt } = card;
      const rows = [["Template", t.label], ["Drone", t.drone + " · " + t.serial], ["Pattern", t.pattern], ["Cruise alt", alt + " m AGL"], ["Camera", t.camera], ["Waypoints", t.wp + " · " + t.cap + " captures"], ["Est. flight", t.est]];
      return React.createElement("div", { className: "plan-card" },
        React.createElement("div", { className: "plan-card-head" }, React.createElement("span", { className: "eyebrow" }, "Flight Plan"), React.createElement("span", { className: "tag" }, t.id)),
        React.createElement("div", { className: "plan-rows" }, rows.map(([k, v]) =>
          React.createElement("div", { className: "plan-row", key: k }, React.createElement("span", { className: "k" }, k), React.createElement("span", { className: "v" }, v)))));
    }
    // arm card
    const CHECKS = ["GPS lock · 14 satellites", "Battery 100% · 4 cells nominal", "Geofence & RTL armed", "Camera & gimbal calibrated"];
    return React.createElement("div", { className: "plan-card arm" },
      React.createElement("div", { className: "checklist" },
        CHECKS.map((c, i) => React.createElement("div", { className: "check" + (checks > i ? " ok" : ""), key: i },
          React.createElement("span", { className: "cbox" }, checks > i ? React.createElement(window.Icon, { name: "check", size: 12 }) : React.createElement("span", { className: "spin", style: { width: 11, height: 11 } })),
          c))),
      React.createElement("div", { className: "speed-row" },
        React.createElement("span", { className: "eyebrow" }, "Replay speed"),
        React.createElement("div", { className: "seg" },
          [3, 6, 12].map((s) => React.createElement("button", { key: s, className: "seg-btn" + (speed === s ? " on" : ""), onClick: () => setSpeed(s) }, s + "×")))),
      React.createElement("button", { className: "btn btn-primary start-btn", disabled: checks < 4 || launching, onClick: onStart },
        launching ? React.createElement(React.Fragment, null, React.createElement("span", { className: "spin", style: { width: 14, height: 14 } }), "Launching…")
          : React.createElement(React.Fragment, null, React.createElement(window.Icon, { name: "play", size: 15, fill: "currentColor", stroke: 0 }), "Start Mission")));
  }

  window.PlanView = PlanView;
})();
