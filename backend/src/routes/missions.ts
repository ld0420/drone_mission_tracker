import { Router, type Request } from 'express';
import { MISSIONS, getMissionById, type Mission } from '../data/missions.js';

export const missionsRouter = Router();

// ---------------------------------------------------------------------------
// Cursor pagination (mission list)
// ---------------------------------------------------------------------------
// Missions are served newest-first and paged with an opaque keyset cursor
// rather than a numeric offset. A cursor encodes the sort key of the last
// item on a page — `${started_at}|${id}` — so the next page is "everything
// strictly after this key". This stays correct if missions are inserted or
// removed between requests (no skipped/duplicated rows the way offsets drift),
// which is what the brief asks for: "show it correctly even if more missions
// are added later."

const MISSIONS_DEFAULT_LIMIT = 10;
const MISSIONS_MAX_LIMIT = 500;

// Same-length ISO timestamps make the concatenated key safe to compare
// lexically (chronological order is preserved); `id` is the tiebreak.
const sortKey = (m: { started_at: string; id: string }) => `${m.started_at}|${m.id}`;

function encodeCursor(key: string): string {
  return Buffer.from(key, 'utf8').toString('base64url');
}

function decodeCursor(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    return Buffer.from(raw, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function parseLimit(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n)
    ? Math.max(1, Math.min(MISSIONS_MAX_LIMIT, Math.floor(n)))
    : fallback;
}

function toSummary(m: Mission) {
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    status: m.status,
    started_at: m.started_at,
    ended_at: m.ended_at,
    duration_seconds: m.duration_seconds,
    site: m.site,
    drone: m.drone,
    waypoint_count: m.waypoints.length,
    capture_count: m.captures.length,
  };
}

// GET /api/missions?limit=10&cursor=<opaque> — cursor-paginated summaries.
missionsRouter.get('/missions', (req, res) => {
  const limit = parseLimit(req.query.limit, MISSIONS_DEFAULT_LIMIT);
  const cursorKey = decodeCursor(req.query.cursor);

  // Newest first; descending by (started_at, id).
  const sorted = [...MISSIONS].sort((a, b) =>
    sortKey(a) < sortKey(b) ? 1 : sortKey(a) > sortKey(b) ? -1 : 0,
  );

  // Keyset seek: skip everything up to and including the cursor key. In a
  // descending list, the next page is the items whose key is strictly less.
  const start = cursorKey ? sorted.findIndex((m) => sortKey(m) < cursorKey) : 0;
  const startIndex = start === -1 ? sorted.length : start;

  const page = sorted.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < sorted.length;
  const last = page[page.length - 1];

  res.json({
    items: page.map(toSummary),
    next_cursor: hasMore && last ? encodeCursor(sortKey(last)) : null,
    has_more: hasMore,
    limit,
    total: sorted.length,
  });
});

// ---------------------------------------------------------------------------
// Offset pagination (captures) — unchanged; dense missions index by position.
// ---------------------------------------------------------------------------

function parseOffsetPage<T>(items: T[], req: Request, defaultLimit = 100) {
  const limit = parseLimit(req.query.limit, defaultLimit);
  const rawOffset = Number(req.query.offset);
  const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
  };
}

// GET /api/missions/:id — mission metadata + flight-path waypoints.
// Captures are excluded so the payload stays small for dense missions.
missionsRouter.get('/missions/:id', (req, res) => {
  const mission = getMissionById(req.params.id!);
  if (!mission) {
    res.status(404).json({ error: `Mission ${req.params.id} not found` });
    return;
  }
  const { captures: _captures, ...rest } = mission;
  res.json({ ...rest, capture_count: mission.captures.length });
});

// GET /api/missions/:id/captures?limit=&offset= — paginated capture list.
missionsRouter.get('/missions/:id/captures', (req, res) => {
  const mission = getMissionById(req.params.id!);
  if (!mission) {
    res.status(404).json({ error: `Mission ${req.params.id} not found` });
    return;
  }
  res.json(parseOffsetPage(mission.captures, req));
});

// GET /api/missions/:id/path — map-ready GeoJSON for the detail view.
//
// The detail map needs three things at once: the planned flight path, the
// waypoints (with photo-stop vs. transit classified server-side), and every
// directional capture. Serving them paginated would force the client to fetch
// all pages just to draw the map, so this endpoint returns the whole geometry
// in one shot — captures here carry only position + heading (no image bytes),
// so the payload stays small even for the ~190-capture missions. Thumbnails
// still come from the paginated /captures endpoint.
missionsRouter.get('/missions/:id/path', (req, res) => {
  const mission = getMissionById(req.params.id!);
  if (!mission) {
    res.status(404).json({ error: `Mission ${req.params.id} not found` });
    return;
  }

  const captureWaypoints = new Set(mission.captures.map((c) => c.waypoint_index));

  // Classify each waypoint so the map can style photo stops distinctly from
  // transit / takeoff / RTL points.
  const classify = (w: (typeof mission.waypoints)[number]) => {
    if (captureWaypoints.has(w.index)) return 'photo';
    if (w.alt === 0) return 'ground'; // takeoff / landing at the dock
    return 'transit';
  };

  const coordinates = mission.waypoints.map((w) => [w.lon, w.lat]);

  // Bounding box over the flight path so the client can fitBounds directly.
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of coordinates) {
    if (lon! < minLon) minLon = lon!;
    if (lon! > maxLon) maxLon = lon!;
    if (lat! < minLat) minLat = lat!;
    if (lat! > maxLat) maxLat = lat!;
  }

  res.json({
    mission_id: mission.id,
    bounds: [
      [minLon, minLat],
      [maxLon, maxLat],
    ],
    path: {
      type: 'Feature',
      properties: { kind: 'planned' },
      geometry: { type: 'LineString', coordinates },
    },
    waypoints: {
      type: 'FeatureCollection',
      features: mission.waypoints.map((w) => ({
        type: 'Feature',
        properties: {
          index: w.index,
          alt: w.alt,
          heading: w.heading,
          is_capture: captureWaypoints.has(w.index),
          kind: classify(w),
        },
        geometry: { type: 'Point', coordinates: [w.lon, w.lat] },
      })),
    },
    captures: {
      type: 'FeatureCollection',
      features: mission.captures.map((c) => ({
        type: 'Feature',
        properties: {
          seq: c.seq,
          heading: c.heading,
          alt: c.alt,
          waypoint_index: c.waypoint_index,
          image_id: c.image_id,
        },
        geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
      })),
    },
  });
});
