# Frontend Take-Home — Mission Tracker

Welcome. We'd like you to build a frontend for a drone mission tracker. The backend is already built and runs locally; you build the UI.

## What you're given

```
mission-tracker-takehome/
├── TAKEHOME.md       <- this file (problem statement + API contract)
└── backend/          <- Express + TypeScript server. Self-contained, no DB.
    └── src/data/missions.ts   <- the canonical dataset
```

You'll add a `frontend/` folder. Set it up however you prefer — Vite + React + TS is the obvious choice, but use what's productive for you.

> **You have a lot of freedom here.** Pick any UI library, design system, map
> library, state library, or styling approach you like. Change the backend —
> add endpoints, rename fields, paginate differently, swap the dataset, whatever
> makes your demo case stronger. We're evaluating your judgment, not your
> conformance to a fixed spec. Just call out the non-obvious choices in your
> `SOLUTION.md`.

## What we'd like you to build

A web app that lets a drone operator do two things:

### 1. Review past missions

A **list view** of past missions (`GET /api/missions`) — name, drone, duration, capture count, started_at. The list endpoint is paginated; show it correctly even if more missions are added later.

Clicking a mission opens a **detail view** with:

- **A map of the inspection site** (Mapbox GL JS, MapLibre, deck.gl — your call). Show:
  - The **flight path** drawn as a polyline through the mission's waypoints.
  - **Waypoint markers** along the path. Each waypoint is a photo stop — make it obvious which waypoints have a captured image vs. which are just transit/turn points (e.g. takeoff, RTL).
  - **Directional capture markers**: each capture has a `heading` (camera-facing direction in degrees), so the marker should communicate where the camera was pointing — a cone, arrow, or rotated icon. A plain dot loses the information.
- **A captures sidebar / drawer / list** loaded from the paginated `/captures` endpoint. The biggest missions have ~190 photos; think about pagination + lazy thumbnails. Each thumbnail should show its sequence number so the order on the map matches the order in the list.
- **Image navigation.** Clicking a thumbnail or a map marker opens that image in a **fullscreen viewer**. From inside the viewer the user should be able to step forward / backward through every capture in the mission (arrow keys, on-screen buttons, swipe — whichever you like). The map's selected marker should stay in sync with the open image so the operator can see "where on site was this taken?".
- **Mission metadata.** Drone, serial, duration, started/ended timestamps, status. A short, scannable panel — not a wall of text.

Aborted missions should be visibly distinct (the dataset includes one) and surface the abort reason from the data.

### 2. Plan & start a mission via chat

Build a small **chat-style planning surface** where the operator converses with the system to set up a flight — picks a site, picks a mission type, confirms parameters — and ends the conversation by launching the live mission. **The "Start Mission" button lives inside the chat** as the natural terminal action; there is no separate standalone button.

It doesn't need to be a real LLM. Scripted / heuristic replies, quick-reply buttons, even a finite-state flow are all fine — what we want to see is:

- A conversation that feels coherent (not a single textarea + send button), with reasonable affordances: typing indicators, message-in animations, suggested replies.
- A clear progression — operator chooses *what* to fly, *where*, *which parameters*, then confirms.
- A clean handoff to the live mission view once they hit start.

Treat the chat as a UX surface to demonstrate your interaction taste, not a backend exercise. Don't build a chat infrastructure — fake the replies.

### 3. Watch a live mission

Once the chat fires off a mission:

- POST to `/api/missions/start` to spin up a new run, then subscribe to the SSE stream at `/api/missions/:run_id/stream`.
- Show the drone **moving on the map in real time**, with a trailing breadcrumb of where it's been (the "actual" path), distinct from the "planned" path the past-mission view shows.
- Render a **HUD** with battery, altitude, signal, heading, elapsed time. The numbers should update smoothly — telemetry arrives at 5 Hz, so think about update cadence vs. re-render cadence.
- **Pop up newly-captured images** as they come in over the stream. Don't make the operator scroll a hundred items to find the latest.
- **Handle the terminal events.** `mission_complete` should feel like a clean wrap-up (summary card, totals). `mission_aborted` includes a human-readable `reason` — surface it clearly.

All three surfaces should feel polished — this is the operator's daily tool.

### Layout is your call

How you compose these surfaces — the map, the planning chat, the mission-history list, the per-waypoint image showcase on past-mission maps, the live HUD — is **entirely your decision**. A single-screen cockpit with everything visible at once is one answer. A multi-pane workspace, a routed multi-page app, a sidebar/drawer pattern, a tabbed view, or a focus-mode flow where surfaces fade in and out are all valid. Show us your information-architecture instincts: what does an operator need in their peripheral vision, and what's one click away? Defend the choice in your `SOLUTION.md`.

## How to run

```bash
# Backend (in one terminal)
cd backend
npm install
npm run dev
# → http://localhost:4571
```

Then start your frontend in another terminal and proxy `/api` → `http://localhost:4571`.

## API contract

Base URL: `http://localhost:4571`. All endpoints are JSON. `lat`/`lon` are decimal degrees (WGS84); `alt` is meters AGL; `heading` is degrees clockwise from north; `battery_pct` and `signal` are 0–100; `elapsed_s` is seconds since the live run started.

### `GET /api/missions?limit=20&offset=0`
Paginated list of mission summaries (no waypoints, no captures — just the metadata you'd show on a card).

`limit` defaults to 20 (max 500). `offset` defaults to 0.

```json
{
  "items": [
    {
      "id": "msn-grid-1",
      "name": "Solar Array Grid Inspection",
      "type": "inspection",
      "status": "complete",
      "started_at": "2026-05-26T14:12:00.000Z",
      "ended_at": "2026-05-26T14:24:31.000Z",
      "duration_seconds": 751,
      "site": {
        "id": "site-demo-001",
        "name": "Greenfield Solar",
        "dock": { "lat": 33.252968, "lon": -91.664321 }
      },
      "drone": { "model": "Sentinel X1", "serial": "SX1-A4F2-9921" },
      "waypoint_count": 14,
      "capture_count": 5
    }
  ],
  "total": 7,
  "limit": 20,
  "offset": 0
}
```

### `GET /api/missions/:id`
Mission metadata + the full waypoint list (the flight path). **Captures are not inline** — fetch them separately so the payload stays small even for the dense missions.

```json
{
  "id": "msn-mosaic-6",
  "name": "Full-Site Photogrammetry Mosaic",
  "type": "mosaic",
  "status": "complete",
  "duration_seconds": 2772,
  "site": { ... },
  "drone": { ... },
  "waypoints": [
    { "index": 0, "lat": 33.252968, "lon": -91.664321, "alt": 0, "heading": 90, "hold_seconds": 0 },
    { "index": 1, "lat": 33.252968, "lon": -91.664321, "alt": 60, "heading": 90, "hold_seconds": 0 },
    ...
  ],
  "capture_count": 2497
}
```

### `GET /api/missions/:id/captures?limit=100&offset=0`
Paginated capture list. Each capture references the `waypoint_index` at which it was taken and includes a `heading` (camera-facing direction in degrees, 0=N, 90=E) so you can render a directional marker.

```json
{
  "items": [
    {
      "image_id": "msn-grid-1-img-0001",
      "lat": 33.25393,
      "lon": -91.66597,
      "alt": 35,
      "heading": 90,
      "waypoint_index": 3,
      "seq": 1
    }
  ],
  "total": 144,
  "limit": 100,
  "offset": 0
}
```

### `POST /api/missions/start`
Start a new live mission run.

**Body** (optional): `{ "mission_template_id": "msn-thermal-3" }`. If omitted, the server picks one of the small missions (the dense missions take 40+ min to replay even at speed=3, so you have to pick them explicitly).

**Response:**
```json
{
  "run_id": "run-1780029082893-n7ypyl",
  "mission": { ...same shape as GET /api/missions/:id... },
  "stream_url": "/api/missions/run-1780029082893-n7ypyl/stream"
}
```

### `GET /api/missions/:run_id/stream`
Server-Sent Events stream of telemetry + image-captured events. Connect with `EventSource` or `fetch` + a parser.

**Query params:**
- `speed` — playback speed multiplier (default `3`, range `0.5`–`20`). `1.0` = real-time.

**Event types:**

```
event: telemetry
data: { "type":"telemetry", "ts":"...", "lat":..., "lon":..., "alt":..., "heading":..., "battery_pct":..., "signal":..., "elapsed_s":... }

event: image_captured
data: { "type":"image_captured", "ts":"...", "waypoint_index":..., "image_id":"msn-grid-1-img-0001", "lat":..., "lon":..., "alt":..., "heading":... }

event: mission_complete          (or mission_aborted, with a `reason` field)
data: { "type":"mission_complete", "ts":"...", "elapsed_s":... }
```

The stream closes after the terminal event. Telemetry frames arrive at **5 Hz** at speed=1 (faster at higher speeds).

### `GET /api/images/:image_id`
Returns one of three rotating placeholder images as PNG. The same `image_id` always returns the same image (deterministic hash), so caching is safe.

## Mission catalog

| ID | Name | Waypoints | Captures | Notes |
|---|---|---:|---:|---|
| `msn-grid-1` | Solar Array Grid Inspection | 148 | 144 | S-pattern grid, nadir camera |
| `msn-patrol-2` | Perimeter Security Patrol | 126 | 122 | Rectangle around site, outward-facing camera |
| `msn-thermal-3` | Thermal Anomaly Sweep | 144 | 140 | Orbits around hot-spots, inward-facing camera |
| `msn-health-4` | Routine Site Health Check | 178 | 174 | Denser serpentine, lower altitude |
| `msn-aborted-5` | Aborted Inspection (Low Battery) | 83 | 79 | Mission ends with `mission_aborted` event |

All missions are anchored at the demo site (`33.252968, -91.664321`).

## Constraints

- **React + TypeScript** for the app.
- **A web map library** — Mapbox GL JS, MapLibre GL JS, deck.gl — anything with rich map rendering. Mapbox GL needs an access token (free tier covers this take-home; sign up at mapbox.com → Account → Tokens). MapLibre is API-compatible and works without a token.
- **Time budget — 6–8 hours of focused work.** We're not looking for every feature; we're looking for how you make trade-offs.

## What we care about

- **Design.** Layout, typography, hierarchy, color, density, motion. We treat design as a first-class evaluation axis — a clean visual system that respects the operator's attention will score higher than a feature-complete UI that looks like a wireframe. Feel free to put together a mood board / reference set before you start designing (Dribbble, Linear, Vercel, helicopter-cockpit HUDs, whatever fits the vibe) — happy to see it in your `SOLUTION.md`.
- **Interactions, animations, and user experience.** This is what separates a usable app from a delightful one. Hover states, focus rings, drag affordances, transitions when the lightbox opens, when a new image pops in during a live mission, when the drone marker moves — these matter. Smooth ≠ flashy: the right easing for a 200ms transform beats a fancy 2-second intro. Loading states, error states, empty states, sensible defaults, keyboard shortcuts where they help. A well-thought-through 80% beats a clunky 100%.
- **Real-time handling.** The SSE stream emits at 5 Hz; the live map needs to feel smooth. Think about what re-renders on every frame and what doesn't. Imperative map updates vs. declarative React state — both have a place.
- **Scale.** The longest mission has ~190 captures and ~190 directional markers. Fetch and render strategy matters: pagination, virtualization, lazy thumbnails, clustering at low zoom — pick what's right.
- **Data flow + state management.** Pick a tool (Context / Zustand / Redux / your own hooks) and use it consistently. Show that you reason about what state belongs where.
- **Code organization.** Feature folders, hooks, types co-located. Anyone joining the project should be able to follow your structure.

## What's optional but nice

- **URL state** — deep-link to a specific past mission or a paginated page of captures.
- **Follow-drone toggle** — let the user lock the camera onto the drone or pan freely.
- **Mission-complete summary** — when the live stream ends, show a recap (duration, captures, distance flown).
- **Capture clustering at low zoom** — 190 individual cones get noisy zoomed out.
- **Dark mode.**
- **A test or two** — pick whatever you'd write tests for in real life and explain why.

## Deliverable

A Git repo (or zip) containing your frontend + a short **`SOLUTION.md`** (or Loom video, your choice) walking through:
1. How to run it
2. The architecture decisions you made and why
3. What you'd do next with more time
4. Any trade-offs you explicitly didn't make

The walkthrough matters at least as much as the code. We'd rather see you explain why you skipped feature X than ship a half-broken version of it.

## Hints

- `GET /api/images/:image_id` is deterministic — same id → same image. Cache freely.
- The SSE stream's `?speed=N` (default 3) is handy for demoing a finished live feature without waiting through real-time flights.
- The `mission_aborted` terminal event includes a human-readable `reason` field. Surface it in the UI.
- The 5 missions cover different camera patterns — forward-facing, outward-facing, orbital. Make sure your directional marker works on all of them.

Good luck.
