// The mission dataset. Five synthetic past missions over a fake solar
// inspection site, generated procedurally so the file stays compact.
// `MISSIONS` (exported below) is the canonical list — everything the API
// serves derives from it.
//
// Each mission has:
//   - `waypoints` — the planned flight path. Each waypoint is a hold / photo
//     stop. Missions land in the 70-200 waypoint band.
//   - `captures` — one capture per waypoint where the drone took a photo.
//     Each capture carries a `heading` (camera-facing direction in degrees)
//     so the UI can render a directional icon on the map.
//
// Captures are served paginated so the frontend has to think about
// pagination / virtualization for the bigger missions. Live mission runs
// reuse this same data — the simulator interpolates between waypoints and
// emits each capture as an `image_captured` SSE event when its waypoint
// is reached.
//
// Candidates: edit this file freely. Add missions, change flight patterns,
// or anchor to a different site — whatever makes your demo stronger.

export interface Waypoint {
  index: number;
  lat: number;
  lon: number;
  alt: number; // meters AGL
  /** Drone heading in degrees (0=N, 90=E). */
  heading: number;
  /** Seconds the drone hovers at this waypoint before moving on. */
  hold_seconds: number;
}

export interface Capture {
  image_id: string;
  lat: number;
  lon: number;
  alt: number;
  /** Camera-facing direction in degrees (0=N, 90=E). */
  heading: number;
  /** Waypoint at which this capture occurs. */
  waypoint_index: number;
  /** Sequence number within the mission, 1-indexed. */
  seq: number;
}

export interface Mission {
  id: string;
  name: string;
  type: 'inspection' | 'patrol' | 'thermal' | 'health_check' | 'aborted';
  status: 'complete' | 'aborted';
  started_at: string;
  ended_at: string;
  /** Total flight duration in seconds. */
  duration_seconds: number;
  site: {
    id: string;
    name: string;
    dock: { lat: number; lon: number };
  };
  drone: { model: string; serial: string };
  waypoints: Waypoint[];
  captures: Capture[];
  /** Human-readable reason, present only on aborted missions. */
  abort_reason?: string;
}

const DOCK = { lat: 33.252968, lon: -91.664321 };
const SITE = {
  id: 'site-demo-001',
  name: 'Greenfield Solar',
  dock: DOCK,
};
const DRONE = { model: 'Sentinel X1', serial: 'SX1-A4F2-9921' };

const METERS_PER_DEG_LAT = 111_000;
const mPerDegLon = (lat: number) => METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

function bearingDeg(fromLat: number, fromLon: number, toLat: number, toLon: number): number {
  const dLat = (toLat - fromLat) * METERS_PER_DEG_LAT;
  const dLon = (toLon - fromLon) * mPerDegLon(fromLat);
  return ((Math.atan2(dLon, dLat) * 180) / Math.PI + 360) % 360;
}

/**
 * Build waypoints + captures for a serpentine grid inspection.
 * The drone flies back and forth across `rows` legs, capturing every
 * `captureStepMeters` along each leg.
 */
function buildSerpentine(opts: {
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  rows: number;
  alt: number;
  captureStepMeters: number;
  /** Camera-yaw offset from flight heading (e.g. -90 for "looking left"). */
  cameraYawOffset?: number;
}): { waypoints: Waypoint[]; captureSpec: { waypointIndex: number; heading: number }[] } {
  const waypoints: Waypoint[] = [];
  const captureSpec: { waypointIndex: number; heading: number }[] = [];
  const { startLat, startLon, endLat, endLon, rows, alt, captureStepMeters, cameraYawOffset = 0 } = opts;

  let idx = 0;
  // Takeoff
  waypoints.push({ index: idx++, lat: DOCK.lat, lon: DOCK.lon, alt: 0, heading: 0, hold_seconds: 0 });
  waypoints.push({ index: idx++, lat: DOCK.lat, lon: DOCK.lon, alt, heading: 0, hold_seconds: 0 });

  // Serpentine legs
  for (let r = 0; r < rows; r++) {
    const t = rows === 1 ? 0 : r / (rows - 1);
    const lat = startLat + (endLat - startLat) * t;
    const legStartLon = r % 2 === 0 ? startLon : endLon;
    const legEndLon = r % 2 === 0 ? endLon : startLon;
    const heading = bearingDeg(lat, legStartLon, lat, legEndLon);

    // Steps along the leg
    const legMeters = Math.abs(legEndLon - legStartLon) * mPerDegLon(lat);
    const steps = Math.max(1, Math.floor(legMeters / captureStepMeters));

    for (let k = 0; k <= steps; k++) {
      const u = k / steps;
      const lon = legStartLon + (legEndLon - legStartLon) * u;
      waypoints.push({ index: idx, lat, lon, alt, heading, hold_seconds: 0 });
      captureSpec.push({
        waypointIndex: idx,
        heading: (heading + cameraYawOffset + 360) % 360,
      });
      idx++;
    }
  }

  // Return to dock + land
  waypoints.push({ index: idx++, lat: DOCK.lat, lon: DOCK.lon, alt, heading: 180, hold_seconds: 0 });
  waypoints.push({ index: idx++, lat: DOCK.lat, lon: DOCK.lon, alt: 0, heading: 180, hold_seconds: 0 });

  return { waypoints, captureSpec };
}

/**
 * Build waypoints + captures for a polygon patrol — the drone flies around
 * a closed loop and captures outward-facing photos at fixed intervals.
 */
function buildPatrol(opts: {
  corners: { lat: number; lon: number }[];
  alt: number;
  captureStepMeters: number;
  /** Camera-yaw offset from flight heading (90 = looking right / outward). */
  cameraYawOffset: number;
}): { waypoints: Waypoint[]; captureSpec: { waypointIndex: number; heading: number }[] } {
  const waypoints: Waypoint[] = [];
  const captureSpec: { waypointIndex: number; heading: number }[] = [];
  let idx = 0;

  waypoints.push({ index: idx++, lat: DOCK.lat, lon: DOCK.lon, alt: 0, heading: 0, hold_seconds: 0 });
  waypoints.push({ index: idx++, lat: DOCK.lat, lon: DOCK.lon, alt: opts.alt, heading: 0, hold_seconds: 0 });

  // Walk each edge of the polygon, generating capture waypoints
  for (let c = 0; c < opts.corners.length; c++) {
    const from = opts.corners[c]!;
    const to = opts.corners[(c + 1) % opts.corners.length]!;
    const dLat = (to.lat - from.lat) * METERS_PER_DEG_LAT;
    const dLon = (to.lon - from.lon) * mPerDegLon(from.lat);
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);
    const heading = bearingDeg(from.lat, from.lon, to.lat, to.lon);
    const steps = Math.max(1, Math.floor(dist / opts.captureStepMeters));
    for (let k = 0; k <= steps; k++) {
      const u = k / steps;
      const lat = from.lat + (to.lat - from.lat) * u;
      const lon = from.lon + (to.lon - from.lon) * u;
      waypoints.push({ index: idx, lat, lon, alt: opts.alt, heading, hold_seconds: 0 });
      captureSpec.push({
        waypointIndex: idx,
        heading: (heading + opts.cameraYawOffset + 360) % 360,
      });
      idx++;
    }
  }

  waypoints.push({ index: idx++, lat: DOCK.lat, lon: DOCK.lon, alt: opts.alt, heading: 180, hold_seconds: 0 });
  waypoints.push({ index: idx++, lat: DOCK.lat, lon: DOCK.lon, alt: 0, heading: 180, hold_seconds: 0 });

  return { waypoints, captureSpec };
}

/**
 * Build waypoints + captures for a thermal anomaly sweep — orbit around
 * a series of hot-spots, capturing inward-facing photos.
 */
function buildOrbitSweep(opts: {
  hotspots: { lat: number; lon: number }[];
  alt: number;
  orbitRadiusMeters: number;
  capturesPerOrbit: number;
}): { waypoints: Waypoint[]; captureSpec: { waypointIndex: number; heading: number }[] } {
  const waypoints: Waypoint[] = [];
  const captureSpec: { waypointIndex: number; heading: number }[] = [];
  let idx = 0;

  waypoints.push({ index: idx++, lat: DOCK.lat, lon: DOCK.lon, alt: 0, heading: 0, hold_seconds: 0 });
  waypoints.push({ index: idx++, lat: DOCK.lat, lon: DOCK.lon, alt: opts.alt, heading: 0, hold_seconds: 0 });

  for (const hot of opts.hotspots) {
    const dLatPerM = 1 / METERS_PER_DEG_LAT;
    const dLonPerM = 1 / mPerDegLon(hot.lat);
    for (let k = 0; k < opts.capturesPerOrbit; k++) {
      const theta = (k / opts.capturesPerOrbit) * Math.PI * 2;
      const lat = hot.lat + Math.cos(theta) * opts.orbitRadiusMeters * dLatPerM;
      const lon = hot.lon + Math.sin(theta) * opts.orbitRadiusMeters * dLonPerM;
      // Camera faces the hotspot center
      const cameraHeading = bearingDeg(lat, lon, hot.lat, hot.lon);
      // Drone flies tangent to the orbit
      const flightHeading = (cameraHeading + 90) % 360;
      waypoints.push({ index: idx, lat, lon, alt: opts.alt, heading: flightHeading, hold_seconds: 1 });
      captureSpec.push({ waypointIndex: idx, heading: cameraHeading });
      idx++;
    }
  }

  waypoints.push({ index: idx++, lat: DOCK.lat, lon: DOCK.lon, alt: opts.alt, heading: 180, hold_seconds: 0 });
  waypoints.push({ index: idx++, lat: DOCK.lat, lon: DOCK.lon, alt: 0, heading: 180, hold_seconds: 0 });

  return { waypoints, captureSpec };
}

function materialize(
  missionId: string,
  spec: { waypoints: Waypoint[]; captureSpec: { waypointIndex: number; heading: number }[] },
): { waypoints: Waypoint[]; captures: Capture[] } {
  const captures: Capture[] = spec.captureSpec.map((s, i) => {
    const w = spec.waypoints[s.waypointIndex]!;
    return {
      image_id: `${missionId}-img-${String(i + 1).padStart(4, '0')}`,
      lat: w.lat,
      lon: w.lon,
      alt: w.alt,
      heading: s.heading,
      waypoint_index: s.waypointIndex,
      seq: i + 1,
    };
  });
  return { waypoints: spec.waypoints, captures };
}

function buildMission(
  id: string,
  name: string,
  type: Mission['type'],
  status: Mission['status'],
  started_at: string,
  ended_at: string,
  duration_seconds: number,
  spec: { waypoints: Waypoint[]; captureSpec: { waypointIndex: number; heading: number }[] },
  abort_reason?: string,
): Mission {
  const { waypoints, captures } = materialize(id, spec);
  return {
    id,
    name,
    type,
    status,
    started_at,
    ended_at,
    duration_seconds,
    site: SITE,
    drone: DRONE,
    waypoints,
    captures,
    ...(abort_reason ? { abort_reason } : {}),
  };
}

// ---- Mission specs ----
// All anchored at the demo site. Capture step / orbit counts tuned so each
// mission lands in the 70-200 waypoint band.

// 1) Solar Array Grid Inspection — S-pattern, nadir (-ish) capture, 12 rows
//    ~10m × ~210m → ~125 captures
const mission1Spec = buildSerpentine({
  startLat: 33.2526,
  startLon: -91.6660,
  endLat: 33.2540,
  endLon: -91.6635,
  rows: 12,
  alt: 35,
  captureStepMeters: 20,
  cameraYawOffset: 0,
});

// 2) Perimeter Security Patrol — rectangle around site, outward-facing camera
//    ~80 captures
const mission2Spec = buildPatrol({
  corners: [
    { lat: 33.2570, lon: -91.6664 },
    { lat: 33.2570, lon: -91.6620 },
    { lat: 33.2510, lon: -91.6620 },
    { lat: 33.2510, lon: -91.6664 },
  ],
  alt: 50,
  captureStepMeters: 18,
  cameraYawOffset: 90,
});

// 3) Thermal Anomaly Sweep — orbits around several hot-spots, inward camera
//    ~140 captures
const mission3Spec = buildOrbitSweep({
  hotspots: [
    { lat: 33.2540, lon: -91.6645 },
    { lat: 33.2535, lon: -91.6655 },
    { lat: 33.2532, lon: -91.6640 },
    { lat: 33.2528, lon: -91.6650 },
    { lat: 33.2538, lon: -91.6638 },
  ],
  alt: 18,
  orbitRadiusMeters: 8,
  capturesPerOrbit: 28,
});

// 4) Routine Site Health Check — denser serpentine, lower altitude, 14 rows
//    ~185 captures
const mission4Spec = buildSerpentine({
  startLat: 33.2524,
  startLon: -91.6660,
  endLat: 33.2542,
  endLon: -91.6635,
  rows: 14,
  alt: 28,
  captureStepMeters: 18,
  cameraYawOffset: 0,
});

// 5) Aborted Inspection — same as mission 1 but cut off ~halfway, with the
//    drone bailing mid-pattern. ~70 captures.
const mission5Source = buildSerpentine({
  startLat: 33.2526,
  startLon: -91.6660,
  endLat: 33.2540,
  endLon: -91.6635,
  rows: 12,
  alt: 35,
  captureStepMeters: 20,
  cameraYawOffset: 0,
});
function truncateForAbort(spec: ReturnType<typeof buildSerpentine>) {
  const cutoff = Math.floor(spec.captureSpec.length * 0.55);
  const keepIndices = new Set(spec.captureSpec.slice(0, cutoff).map((c) => c.waypointIndex));
  const cutWaypoints: Waypoint[] = [];
  const remap = new Map<number, number>();
  for (const w of spec.waypoints) {
    if (w.alt === 0 || keepIndices.has(w.index)) {
      remap.set(w.index, cutWaypoints.length);
      cutWaypoints.push({ ...w, index: cutWaypoints.length });
    }
  }
  // Tack on an emergency RTL — back to dock from the last kept waypoint
  const last = cutWaypoints[cutWaypoints.length - 1]!;
  cutWaypoints.push({
    index: cutWaypoints.length,
    lat: DOCK.lat,
    lon: DOCK.lon,
    alt: last.alt,
    heading: 180,
    hold_seconds: 0,
  });
  cutWaypoints.push({
    index: cutWaypoints.length,
    lat: DOCK.lat,
    lon: DOCK.lon,
    alt: 0,
    heading: 180,
    hold_seconds: 0,
  });
  const cutCaptures = spec.captureSpec.slice(0, cutoff).map((c) => ({
    ...c,
    waypointIndex: remap.get(c.waypointIndex)!,
  }));
  return { waypoints: cutWaypoints, captureSpec: cutCaptures };
}
const mission5Spec = truncateForAbort(mission5Source);

export const MISSIONS: Mission[] = [
  buildMission(
    'msn-grid-1',
    'Solar Array Grid Inspection',
    'inspection',
    'complete',
    '2026-05-26T14:12:00.000Z',
    '2026-05-26T14:38:11.000Z',
    1571,
    mission1Spec,
  ),
  buildMission(
    'msn-patrol-2',
    'Perimeter Security Patrol',
    'patrol',
    'complete',
    '2026-05-27T09:03:00.000Z',
    '2026-05-27T09:21:47.000Z',
    1127,
    mission2Spec,
  ),
  buildMission(
    'msn-thermal-3',
    'Thermal Anomaly Sweep',
    'thermal',
    'complete',
    '2026-05-27T16:48:00.000Z',
    '2026-05-27T17:14:24.000Z',
    1584,
    mission3Spec,
  ),
  buildMission(
    'msn-health-4',
    'Routine Site Health Check',
    'health_check',
    'complete',
    '2026-05-28T08:30:00.000Z',
    '2026-05-28T09:05:13.000Z',
    2113,
    mission4Spec,
  ),
  buildMission(
    'msn-aborted-5',
    'Aborted Inspection (Low Battery)',
    'aborted',
    'aborted',
    '2026-05-28T13:15:00.000Z',
    '2026-05-28T13:28:44.000Z',
    824,
    mission5Spec,
    'Low battery — emergency return-to-launch triggered',
  ),
];

export function getMissionById(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}
