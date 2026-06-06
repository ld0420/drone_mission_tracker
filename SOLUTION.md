# Mission Tracker — Solution

A frontend for a drone "Mission Tracker": review past missions on a map, plan & start a
mission via chat, and watch a mission stream live. Built on top of the provided
Express + TypeScript backend.

---

## 1. How to run

**Prerequisites:** Node 20+, and a free **Mapbox** access token
(create one at https://account.mapbox.com/access-tokens/ — the free tier is plenty).

**Backend** (the provided API, serves on `http://localhost:4571`):
```bash
cd backend
npm install
npm run dev
```

**Frontend** (Vite dev server on `http://localhost:5173`):
```bash
cd frontend
npm install
cp .env.example .env.local        # then paste your Mapbox token into VITE_MAPBOX_TOKEN
npm run dev
```

Open **http://localhost:5173**. The dev server proxies `/api/*` → `:4571`, so both must be running.

- Production build: `npm run build` (runs `tsc -b` then `vite build`); preview with `npm run preview`.
- Without a Mapbox token the app still runs — the detail map shows a "token missing" placeholder; everything else works.
- **Tip:** the planner's replay-speed selector + the live stream's `?speed=N` let you watch a full live mission in seconds instead of real-time.

---

## 2. Architecture decisions (and why)

**Stack: Vite + React 19 + TypeScript (strict) + Tailwind CSS v4.**
Vite/React per the brief. TS in strict mode for safety on the geo/telemetry data shapes.
Tailwind v4 is CSS-first (`@theme` tokens, no JS config) — the design tokens live in one
place and generate every utility.

**Data layer: TanStack Query, with the pagination model matched to each endpoint.**
- `useMissions` → `useInfiniteQuery` over the backend's **cursor/keyset** pagination
  (`has_more` → `next_cursor`).
- `useCaptures` → `useInfiniteQuery` over **offset** pagination (stable seq order, `offset+limit<total`).
- `useMissionDetail` / `useMissionPath` → plain `useQuery` (immutable per mission).
- One shared `QueryClient` with conservative defaults (60s stale, no refetch-on-focus) since
  mission data is effectively static for a session.

**Backend: I extended the read API to fit the UI (calling this out, per the brief's invitation to change the backend).**
The live stream (`POST /missions/start`, SSE `GET /missions/:run_id/stream`) and media
(`GET /images/:id`, with cache headers) were the moving parts; I shaped the *read* side around
what the surfaces actually needed:
- **`GET /missions` → cursor / keyset pagination** (`limit` + `next_cursor` + `has_more`) rather
  than offset. Cursor is the correct model for a feed (stable under inserts/deletes); I used it to
  demonstrate the pattern even though there are only 5 missions.
- **`GET /missions/:id/path` — a map-ready GeoJSON endpoint** (the key non-obvious addition). It
  pre-shapes the flight path (LineString), waypoints typed as `transit`/`photo`/`ground`, and each
  capture as a Point carrying `heading`/`alt`/`seq`, plus the bounding box — so the client renders
  the whole map from one source with zero geo-munging, and the dense ~190-marker missions draw from
  a single GL symbol layer.
- **`GET /missions/:id/captures` → offset pagination** (not cursor): the sidebar shows captures in
  fixed seq order and may want to jump pages, so offset fits better here than a cursor.
- **`GET /missions/:id`** returns the detail including `abort_reason`, surfaced in the UI per the hint.

**Live streaming is a raw `EventSource`, not a query.** SSE is a push stream, so it doesn't fit
the request/response query model. The key detail: telemetry arrives fast (5 Hz × speed), but I
**decouple stream rate from render rate** — the latest frame is stashed in a ref and flushed to
React state on a fixed ~12 Hz interval, so the HUD and map update at a calm, constant cadence no
matter how fast the replay runs. Terminal events (`mission_complete` / `mission_aborted`, whose
human-readable `reason` is surfaced) close the stream cleanly.

**Two deliberately different maps.**
- *Past-mission detail* uses **Mapbox GL (satellite)** — real terrain matters for reviewing
  captures. The dense missions have ~190 markers, so every directional capture cone is drawn by a
  **single GL symbol layer** (`icon-rotate: ['get','heading']`) rather than ~190 DOM markers — it
  stays smooth, and the heading-driven rotation works across all camera patterns
  (forward/outward/orbital).
- *Live watch* uses a **custom SVG "tactical" schematic** (no tiles). At 12 Hz with a moving drone
  + growing breadcrumb, a pure-SVG overlay re-renders cheaply; the static layers (planned path,
  cones) are memoized so only the drone/trail recompute per frame.

**Routing: React Router v6**, each surface URL-addressable (`/`, `/missions`, `/missions/:id`,
`/plan`, `/live/:runId`) so detail pages are deep-linkable.

**Project structure** — by surface, with the data layer separated by fitness:
```
src/
  components/  chat · live · missions · overview · layout · ui
  api/         fetch client + QueryClient
  hook/        useMissions · useCaptures · useMissionDetail · useMissionStream
  utils/ types/ styles/
```
`@/` path alias → `src/`. Server state → TanStack Query; local UI state → `useState`/refs;
navigation → the router. No global store was needed.

---

## 3. What I'd do next with more time

- **Resolve the Mapbox-surface styling exception.** Most of the missions UI is Tailwind (list,
  row, route glyph, image viewer, captures rail). The **Mapbox-backed detail surface**
  (`MissionMap` + `MissionDetailView`) is deliberately left on hand-written CSS classes
  (`styles/operator.css` + a few rules in `index.css`): converting them to Tailwind utilities
  repeatedly left the live WebGL canvas painting **black** (it loaded tiles fine but wouldn't
  composite under the migrated styling — confirmed reproducible: CSS-class version renders,
  Tailwind version goes black). I'd isolate that specific CSS-vs-WebGL interaction so the surface
  can move to Tailwind too — or keep it as a documented exception (it renders reliably as-is).
- **Give the live map a real satellite base** to match the design reference's `MapView`
  (the design uses aerial tiles for both views; I simplified the live one to SVG for smooth
  real-time rendering). Would rebuild it on Mapbox with the live overlays on top.
- **Wire the Operations Overview + fleet to real data** — those are currently mocked
  (isolated in `mock.ts` files) since they're outside the three core surfaces.
- **Tests** — unit tests for the pure logic (geo projection, cursor/offset paging, the SSE flush
  throttle) and a Playwright smoke test that starts a run and asserts the drone moves.
- **SSE resilience** — reconnect/backoff and resume-from-elapsed instead of dead-ending on
  "Downlink lost" when a connection blips.
- **Accessibility & responsive** — focus management in the fullscreen viewer and chat, ARIA on the
  map controls, and a proper mobile layout (the detail split currently degrades rather than reflows).

---

## 4. Trade-offs I explicitly didn't make

- **The planner is a scripted finite-state chat, not a real LLM.** Deterministic, instant, no API
  cost — and it still does a real `POST /api/missions/start` and hands the `run_id` to the live
  view. A real LLM was out of scope for a planning UI.
- **The list and captures are drained fully, then searched/paged client-side.** I genuinely use the
  cursor and offset endpoints (proving they work), but with only 5 missions and ≤190 captures, I
  load all pages and then do search/sort/paging in the browser — simpler and snappier than
  server round-trips per interaction. With thousands of rows I'd push search/sort to the server.
- **No state-management library.** TanStack Query covers server state; everything else is local.
  Adding Zustand/Redux would've been ceremony.
- **No component library.** The "Operator Control Room" look is bespoke, so I hand-rolled small UI
  primitives rather than fight a library's defaults.
- **The live map is a stylized schematic, not satellite tiles** — a conscious simplification for
  smooth 12 Hz rendering (see §3). It's the clearest divergence from the design reference.
- **SSE handling is fail-fast, not resilient.** On any `EventSource` error I show "Downlink lost"
  and stop — no reconnect/backoff, no resume-from-elapsed. A transient blip dead-ends instead of
  recovering. Fine for a demo; for production I'd add reconnect with backoff (noted in §3).
- **The live stream is sampled at ~12 Hz, not interpolated.** I decouple render rate from the
  5 Hz×speed stream by flushing only the latest frame every ~80 ms (smoothed with a CSS
  transition), so the HUD/map stay calm regardless of replay speed. The cost is that the drone
  moves in small steps and the breadcrumb is slightly sparser than the raw telemetry; per-frame
  rAF interpolation would be smoother but heavier.
- **No route-level code-splitting — Mapbox GL ships in the main bundle.** It's a heavy dependency
  that loads even on routes with no map (overview, planner, live). I traded a larger initial bundle
  for simplicity; `React.lazy`-loading the detail route would trim it.
- **Overview/fleet data is mock.** Kept out of the way in `mock.ts` and clearly fake, since the
  brief's focus was the three mission surfaces.
- **No automated tests.** I leaned on TypeScript strict mode plus manual + headless-browser
  verification given the time box; the pure logic is the part I'd cover first (see §3).
