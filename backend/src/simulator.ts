// Mission simulator. Given a mission, "flies" its waypoints at realistic
// speed and emits telemetry frames at 5 Hz over an async iterator. The drone
// moves at ~8 m/s between waypoints (a reasonable cruise speed for a small drone)
// and respects per-waypoint hold times. Battery drains linearly with time.
//
// The iterator yields three kinds of frames:
//   - { type: 'telemetry', ... }     5 Hz GPS/alt/heading/battery
//   - { type: 'image_captured', ... } emitted when the drone reaches a
//     capture waypoint (the image_id is what the frontend can fetch)
//   - { type: 'mission_complete', ... } emitted once when the drone is back at
//     the dock (or 'mission_aborted' for status=aborted missions)

import type { Capture, Mission, Waypoint } from './data/missions.js';

const TICK_MS = 200; // 5 Hz
const CRUISE_SPEED_MPS = 8;
const VERTICAL_SPEED_MPS = 3; // for takeoff / landing alt changes
const METERS_PER_DEG_LAT = 111_000;

function metersPerDegLon(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

function distanceMeters(a: Waypoint, b: Waypoint): number {
  const dLat = (b.lat - a.lat) * METERS_PER_DEG_LAT;
  const dLon = (b.lon - a.lon) * metersPerDegLon(a.lat);
  const dAlt = b.alt - a.alt;
  return Math.sqrt(dLat * dLat + dLon * dLon + dAlt * dAlt);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Interpolate heading with shortest-arc to avoid 359° → 1° wrap
function lerpHeading(a: number, b: number, t: number): number {
  let diff = b - a;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return (a + diff * t + 360) % 360;
}

export type Frame =
  | {
      type: 'telemetry';
      ts: string;
      lat: number;
      lon: number;
      alt: number;
      heading: number;
      battery_pct: number;
      /** Signal strength 0-100 (synthesized with a touch of noise) */
      signal: number;
      /** Total seconds since mission start. */
      elapsed_s: number;
    }
  | {
      type: 'image_captured';
      ts: string;
      waypoint_index: number;
      image_id: string;
      /** GPS where the image was captured. */
      lat: number;
      lon: number;
      alt: number;
      /** Camera-facing direction (deg, 0=N, 90=E). */
      heading: number;
    }
  | {
      type: 'mission_complete';
      ts: string;
      elapsed_s: number;
    }
  | {
      type: 'mission_aborted';
      ts: string;
      elapsed_s: number;
      reason: string;
    };

export interface SimulatorOptions {
  /** Multiplier on real time. 1.0 = realistic; 5.0 = 5x faster (good for demos). */
  speed?: number;
  /** Starting battery 0-100. Defaults to 100. */
  starting_battery?: number;
}

/**
 * Simulate a mission. Returns an async iterator that yields frames at the
 * configured tick rate. Cancellation is via the returned `stop()` function or
 * by breaking the for-await-of loop.
 */
export function simulateMission(
  mission: Mission,
  opts: SimulatorOptions = {},
): { frames: AsyncGenerator<Frame, void, unknown>; stop: () => void } {
  const speed = opts.speed ?? 1.0;
  const startBattery = opts.starting_battery ?? 100;
  let cancelled = false;

  // Index captures by waypoint_index so we can emit them as we arrive.
  const capturesByWaypoint = new Map<number, Capture[]>();
  for (const c of mission.captures) {
    const arr = capturesByWaypoint.get(c.waypoint_index) ?? [];
    arr.push(c);
    capturesByWaypoint.set(c.waypoint_index, arr);
  }

  async function* gen(): AsyncGenerator<Frame, void, unknown> {
    const startMs = Date.now();
    let elapsedS = 0;
    let batteryPct = startBattery;
    let signal = 92;

    for (let i = 0; i < mission.waypoints.length - 1; i++) {
      if (cancelled) return;
      const from = mission.waypoints[i]!;
      const to = mission.waypoints[i + 1]!;

      const distance = distanceMeters(from, to);
      const dAlt = Math.abs(to.alt - from.alt);
      const isVertical = distance < 0.5 && dAlt > 1; // pure takeoff/landing
      const speedMps = isVertical ? VERTICAL_SPEED_MPS : CRUISE_SPEED_MPS;
      const legDurationS = distance / speedMps;
      const ticks = Math.max(1, Math.floor((legDurationS * 1000) / TICK_MS));

      for (let t = 0; t < ticks; t++) {
        if (cancelled) return;
        const u = t / ticks;
        const lat = lerp(from.lat, to.lat, u);
        const lon = lerp(from.lon, to.lon, u);
        const alt = lerp(from.alt, to.alt, u);
        const heading = lerpHeading(from.heading, to.heading, u);

        // Battery: drain ~0.5% per tick at cruise, ~0.8% during climb
        batteryPct = Math.max(0, batteryPct - (isVertical ? 0.08 : 0.05));
        // Signal: small random walk in 80-98
        signal = Math.max(78, Math.min(98, signal + (Math.random() - 0.5) * 2));
        elapsedS += TICK_MS / 1000;

        yield {
          type: 'telemetry',
          ts: new Date().toISOString(),
          lat,
          lon,
          alt,
          heading,
          battery_pct: Number(batteryPct.toFixed(1)),
          signal: Math.round(signal),
          elapsed_s: Number(elapsedS.toFixed(1)),
        };
        await sleep(TICK_MS / speed);
      }

      // Arrived at the waypoint — emit any captures tied to this waypoint, then hold
      const arrivedCaptures = capturesByWaypoint.get(to.index);
      if (arrivedCaptures) {
        for (const cap of arrivedCaptures) {
          yield {
            type: 'image_captured',
            ts: new Date().toISOString(),
            waypoint_index: to.index,
            image_id: cap.image_id,
            lat: cap.lat,
            lon: cap.lon,
            alt: cap.alt,
            heading: cap.heading,
          };
        }
      }

      if (to.hold_seconds > 0) {
        const holdTicks = Math.floor((to.hold_seconds * 1000) / TICK_MS);
        for (let t = 0; t < holdTicks; t++) {
          if (cancelled) return;
          batteryPct = Math.max(0, batteryPct - 0.02);
          signal = Math.max(78, Math.min(98, signal + (Math.random() - 0.5) * 2));
          elapsedS += TICK_MS / 1000;
          yield {
            type: 'telemetry',
            ts: new Date().toISOString(),
            lat: to.lat,
            lon: to.lon,
            alt: to.alt,
            heading: to.heading,
            battery_pct: Number(batteryPct.toFixed(1)),
            signal: Math.round(signal),
            elapsed_s: Number(elapsedS.toFixed(1)),
          };
          await sleep(TICK_MS / speed);
        }
      }
    }

    // Done with the path. Emit the terminal frame.
    if (mission.status === 'aborted') {
      yield {
        type: 'mission_aborted',
        ts: new Date().toISOString(),
        elapsed_s: Number(((Date.now() - startMs) / 1000).toFixed(1)),
        reason: 'Low battery — emergency return-to-launch triggered',
      };
    } else {
      yield {
        type: 'mission_complete',
        ts: new Date().toISOString(),
        elapsed_s: Number(((Date.now() - startMs) / 1000).toFixed(1)),
      };
    }
  }

  return {
    frames: gen(),
    stop: () => {
      cancelled = true;
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
