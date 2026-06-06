// Domain types mirrored from the backend API contract (see TAKEHOME.md).
// Kept in one place so every feature folder shares the same shapes.

export type MissionType =
  | 'inspection'
  | 'patrol'
  | 'thermal'
  | 'health_check'
  | 'aborted';

export type MissionStatus = 'complete' | 'aborted';

export interface Site {
  id: string;
  name: string;
  dock: { lat: number; lon: number };
}

export interface Drone {
  model: string;
  serial: string;
}

export interface Waypoint {
  index: number;
  lat: number;
  lon: number;
  /** meters AGL */
  alt: number;
  /** degrees, 0=N 90=E */
  heading: number;
  hold_seconds: number;
}

export interface Capture {
  image_id: string;
  lat: number;
  lon: number;
  alt: number;
  /** camera-facing direction in degrees, 0=N 90=E */
  heading: number;
  waypoint_index: number;
  /** 1-indexed sequence within the mission */
  seq: number;
}

/** Shape returned by the paginated list endpoint (no waypoints/captures). */
export interface MissionSummary {
  id: string;
  name: string;
  type: MissionType;
  status: MissionStatus;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  site: Site;
  drone: Drone;
  waypoint_count: number;
  capture_count: number;
}

/** Shape returned by GET /api/missions/:id — full waypoint path inline. */
export interface MissionDetail {
  id: string;
  name: string;
  type: MissionType;
  status: MissionStatus;
  started_at?: string;
  ended_at?: string;
  duration_seconds: number;
  site: Site;
  drone: Drone;
  waypoints: Waypoint[];
  capture_count: number;
  /** present on aborted missions */
  abort_reason?: string;
}

/** Offset-paginated response (captures). */
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** Cursor-paginated response (mission list). `next_cursor` is null on the
 *  last page; pass it back as `?cursor=` to fetch the next page. */
export interface CursorPage<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
  limit: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Map geometry (GET /api/missions/:id/path) — map-ready GeoJSON
// ---------------------------------------------------------------------------

export type WaypointKind = 'photo' | 'transit' | 'ground';

export interface WaypointFeatureProps {
  index: number;
  alt: number;
  heading: number;
  is_capture: boolean;
  kind: WaypointKind;
}

export interface CaptureFeatureProps {
  seq: number;
  heading: number;
  alt: number;
  waypoint_index: number;
  image_id: string;
}

type PointFeature<P> = {
  type: 'Feature';
  properties: P;
  geometry: { type: 'Point'; coordinates: [number, number] };
};

export interface MissionPath {
  mission_id: string;
  /** [[minLon, minLat], [maxLon, maxLat]] — feed straight to fitBounds. */
  bounds: [[number, number], [number, number]];
  path: {
    type: 'Feature';
    properties: { kind: 'planned' };
    geometry: { type: 'LineString'; coordinates: [number, number][] };
  };
  waypoints: {
    type: 'FeatureCollection';
    features: PointFeature<WaypointFeatureProps>[];
  };
  captures: {
    type: 'FeatureCollection';
    features: PointFeature<CaptureFeatureProps>[];
  };
}

// ---------------------------------------------------------------------------
// Live mission (SSE) types
// ---------------------------------------------------------------------------

export interface TelemetryEvent {
  type: 'telemetry';
  ts: string;
  lat: number;
  lon: number;
  alt: number;
  heading: number;
  battery_pct: number;
  signal: number;
  elapsed_s: number;
}

export interface ImageCapturedEvent {
  type: 'image_captured';
  ts: string;
  waypoint_index: number;
  image_id: string;
  lat: number;
  lon: number;
  alt: number;
  heading: number;
}

export interface MissionCompleteEvent {
  type: 'mission_complete';
  ts: string;
  elapsed_s: number;
}

export interface MissionAbortedEvent {
  type: 'mission_aborted';
  ts: string;
  elapsed_s: number;
  reason: string;
}

export type StreamEvent =
  | TelemetryEvent
  | ImageCapturedEvent
  | MissionCompleteEvent
  | MissionAbortedEvent;

export interface StartMissionResponse {
  run_id: string;
  mission: MissionDetail;
  stream_url: string;
}
