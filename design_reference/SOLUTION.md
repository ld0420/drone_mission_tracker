# Mission Tracker — Solution Notes

A design-forward frontend for a drone mission operator: **review past missions**, **plan & launch via chat**, and **watch a live mission**. This repo is a high-fidelity, fully-interactive prototype (single-page, React) that doubles as the visual + interaction blueprint for the production build.

---

## 1. How to run

```bash
# just open it — no build step
open index.html          # macOS
# or serve the folder so the map tiles load over http
npx serve .
```

Routes are hash-based, so everything is deep-linkable:

| Route | Surface |
|---|---|
| `#/missions` | Mission history list |
| `#/missions/:id` | Mission detail (map + captures + viewer) |
| `#/plan` | Chat planner |
| `#/live/:run_id/:template_id` | Live mission cockpit |

The list → detail → viewer flow, the planner conversation, and the live HUD are all wired and clickable.

---

## 2. Design direction — "Operator Control Room"

Design was treated as the primary axis. The system:

- **Mapping-first, dark.** The satellite map is the hero on the detail and live surfaces; UI rides on top as glass panels so the operator's eye stays on the site. Warm near-blacks (never `#000`), off-white text — easy on the eyes in a field/ops context.
- **One signal accent — telemetry emerald** (`#4fe3a1`) for flight paths, active states, and the live drone. **Amber → red** is reserved for warnings/aborts so they read instantly against the green.
- **Type:** Hanken Grotesk for UI/body, **JetBrains Mono** for all telemetry, coordinates, IDs and HUD numbers — the cockpit-instrument feel.
- **Directional captures as rotated cones.** Each capture's camera `heading` is drawn as a cone fanning in the facing direction — works for nadir (travel-aligned), outward (patrol), and inward (orbit) patterns. A plain dot would throw the heading away.
- **Aborted missions are first-class:** red route line, red row accent + left bar in the list, and the `abort_reason` surfaced in a banner (past) and the terminal summary (live).

---

## 3. Information architecture (the layout call)

A **routed multi-surface workspace**, not a single cockpit:

- **History** is a calm, scannable table — route glyph, status, drone, duration, captures, start. It's the operator's "what happened" home.
- **Detail** is a **split**: map fills, captures dock on the right, metadata floats bottom-left, legend top-right. Everything about one mission is visible at once; the fullscreen viewer is one click away and stays bidirectionally synced with the map.
- **Plan** is a focused, full-width chat — nothing competes with the conversation that ends in launch.
- **Live** is a true **single-screen cockpit**: map + drone + trail, a HUD instrument strip, and capture pop-ins. Peripheral glanceable data (battery/alt/signal/heading/elapsed) lives in the HUD; detail (the actual photos) pops in and is one click from fullscreen.

The reasoning: a past-mission review is a *lean-in, analytical* task (give it structure and space), while a live flight is a *monitor, glanceable* task (give it one screen and motion).

---

## 4. Architecture

```
mock/data.js        # generates 8 missions to the exact API shapes
                    #   (list summaries, /:id waypoints, /:id/captures);
                    #   geometry built in a local ENU plane → WGS84.
mock/images.js      # procedural aerial imagery — 3 rotating base scenes
                    #   per camera type (solar / thermal IR / ground),
                    #   deterministic by image_id, cached as data URLs.
components/
  MapView.jsx       # map wrapper (path, dock, directional cones, selection
                    #   sync) + imperative ref API for 5Hz live updates
  ListView.jsx      # paginated history
  DetailView.jsx    # orchestrates map + captures + viewer in sync
  Captures.jsx      # scroll-windowed lazy thumbnails + seq + progress
  Viewer.jsx        # fullscreen viewer (keyboard / buttons / swipe / filmstrip)
  Chat.jsx          # finite-state planner → in-chat Start Mission
  Live.jsx          # simulated SSE stream, HUD, capture pop-ins, terminals
  util / icons      # formatters, route glyph, status pill, icon set
```

**State strategy.** State is co-located by surface and lifted only as far as it needs to go — `DetailView` owns `selectedSeq` + `viewerOpen` and pushes them to the map, the captures rail, and the viewer so all three stay in lockstep. The map is driven **imperatively** (a `ref` API: `setDrone`, `setTrail`, `addCapture`) precisely so high-frequency updates don't re-render React. In production I'd reach for Zustand once cross-surface state (e.g. an active live run visible from any route) appears; for a prototype this size, hooks + co-location is the honest choice.

**Scale.** Capture *metadata* is paginated (100/page) and fetched progressively with a visible progress bar; capture *images* are lazy (only generated/loaded as you scroll, windowed in the viewer filmstrip). The largest mission's ~190 markers render fine as lightweight SVG markers.

**Real-time.** The live stream is simulated from the mission's own waypoints/captures. The clock is **time-based** (`performance.now()`), so the drone position is correct regardless of frame cadence. The map updates every tick imperatively; the **HUD re-renders throttled (~8 Hz)** — decoupling render cadence from update cadence, exactly the 5 Hz concern in the brief. `?speed` is honored as a replay multiplier chosen in the planner.

---

## 5. Non-obvious choices / trade-offs I made on purpose

- **Map library: Leaflet here, MapLibre in production.** The brief asks for MapLibre/Mapbox/deck.gl, and the real app should use MapLibre GL (vector, GPU, rotation, clustering). This *preview sandbox blocks MapLibre's web worker*, so its style pipeline never initializes. To ship a working, reviewable prototype I render with **Leaflet over Esri World Imagery** (DOM raster tiles — bulletproof) and kept the map wrapper behind a small API so swapping to MapLibre is a localized change. The directional-cone, selection-sync, and live-trail logic all port directly.
- **Cones over clustering (for now).** Individual cones communicate heading; at full-site zoom on a 190-shot mission they get dense. Clustering at low zoom is the right next step — noted below — but I prioritized the heading read.
- **Procedural images, not bundled assets.** Matches the real API's "3 rotating placeholders" behavior, stays deterministic per `image_id` (cache-safe), and keeps the repo asset-free.
- **Scroll-windowed thumbnails instead of `IntersectionObserver`.** IO callbacks don't fire in the preview sandbox; scroll-reveal is the robust equivalent and still avoids generating 190 thumbnails up front. In production with a real DOM I'd use IO + a virtualized grid.
- **Chat is a scripted finite-state flow**, not an LLM — coherent copy, typing indicators, suggested replies, an animated pre-flight checklist, and the **Start Mission button as the terminal action inside the conversation**.

---

## 6. What I'd do next with more time

1. **Swap Leaflet → MapLibre GL** (vector basemap, true map rotation, `icon-rotate` symbol layers for cones, GPU performance) — the wrapper API is already shaped for it.
2. **Capture clustering** at low zoom + a heatmap toggle for dense missions.
3. **URL state for the viewer** (`#/missions/:id?seq=42`) and the captures page, for true deep links.
4. **Real data layer:** React Query for the paginated endpoints with caching/retry, and a real `EventSource` for the SSE stream (the sim already mirrors its event shapes: `telemetry` / `image_captured` / `mission_complete|aborted`).
5. **Virtualized captures grid** + IO lazy-loading once on real infra.
6. **A couple of tests:** the ENU→WGS84 + bearing math (pure, high-value), and the capture/selection sync reducer in the detail view.

## 7. What I explicitly did *not* do

- No real backend integration (mocked to the documented shapes) — the point here was the UI and interaction system.
- No clustering/virtualization library pulled in — kept the prototype dependency-light (React + Leaflet only).
- No auth, settings, or multi-site switching — scaffolded in the nav but out of scope for the brief.
