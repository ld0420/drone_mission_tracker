import { useMemo } from 'react';
import type { ImageCapturedEvent, MissionPath, TelemetryEvent } from '@/types/mission';

interface LiveMapProps {
  plannedPath: MissionPath;
  frame: TelemetryEvent | null;
  trail: Array<[number, number]>;
  captures: ImageCapturedEvent[];
  /** lock the view onto the drone (vs. frame the whole route) */
  follow?: boolean;
}

type Pt = { x: number; y: number };

/** Equirectangular fit of the mission bounds into a viewBox (no map tiles —
 *  a clean tactical schematic, per the live design). */
function makeProjection(bounds: MissionPath['bounds']) {
  const [[minLon, minLat], [maxLon, maxLat]] = bounds;
  const midLat = (minLat + maxLat) / 2;
  const lonScale = Math.cos((midLat * Math.PI) / 180);
  const gw = Math.max((maxLon - minLon) * lonScale, 1e-9);
  const gh = Math.max(maxLat - minLat, 1e-9);
  // Fixed viewBox (not aspect-derived) so short/wide and tall routes both fill
  // the frame consistently. P is the margin in viewBox units — larger = more
  // zoomed out.
  const W = 1200;
  const H = 900;
  const P = 180;
  const s = Math.min((W - 2 * P) / gw, (H - 2 * P) / gh);
  const offX = (W - gw * s) / 2;
  const offY = (H - gh * s) / 2;
  const project = (lon: number, lat: number): Pt => ({
    x: offX + (lon - minLon) * lonScale * s,
    y: H - (offY + (lat - minLat) * s),
  });
  return { W, H, project };
}

export function LiveMap({ plannedPath, frame, trail, captures, follow }: LiveMapProps) {
  const { W, H, project } = useMemo(
    () => makeProjection(plannedPath.bounds),
    [plannedPath.bounds],
  );

  // Static between captures — memoized so the 12 Hz drone/breadcrumb re-renders
  // don't rebuild the planned route string or all the cone elements each frame.
  const plannedPts = useMemo(
    () =>
      plannedPath.path.geometry.coordinates
        .map(([lon, lat]) => {
          const p = project(lon, lat);
          return `${p.x},${p.y}`;
        })
        .join(' '),
    [plannedPath, project],
  );

  const coneEls = useMemo(
    () =>
      captures.map((c, i) => {
        const p = project(c.lon, c.lat);
        return (
          <g key={c.image_id ?? i} transform={`translate(${p.x} ${p.y}) rotate(${c.heading})`}>
            <path
              d="M0 -10 L-6 5 L6 5 Z"
              fill="rgba(79,227,161,0.42)"
              stroke="#4fe3a1"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            <circle r={2.4} fill="#4fe3a1" />
          </g>
        );
      }),
    [captures, project],
  );

  // Dynamic — grows every frame.
  const trailPts = trail
    .map(([lon, lat]) => {
      const p = project(lon, lat);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  const first = plannedPath.path.geometry.coordinates[0];
  const dock = first ? project(first[0], first[1]) : null;
  const drone = frame ? project(frame.lon, frame.lat) : null;

  // Point the drone the way it's actually moving (bearing between recent
  // breadcrumb points), not the telemetry heading — for orbit/patrol patterns
  // the camera heading can differ from the travel direction.
  let droneRot = frame?.heading ?? 0;
  if (drone) {
    for (let i = trail.length - 2; i >= Math.max(0, trail.length - 16); i--) {
      const p = project(trail[i]![0], trail[i]![1]);
      const dx = drone.x - p.x;
      const dy = drone.y - p.y;
      if (Math.hypot(dx, dy) > 4) {
        droneRot = (Math.atan2(dx, -dy) * 180) / Math.PI;
        break;
      }
    }
  }

  // Follow: a zoomed window centred on the drone (clamped); else frame all.
  let viewBox = `0 0 ${W} ${H}`;
  if (follow && drone) {
    const vw = W * 0.5;
    const vh = H * 0.5;
    const x = Math.max(0, Math.min(W - vw, drone.x - vw / 2));
    const y = Math.max(0, Math.min(H - vh, drone.y - vh / 2));
    viewBox = `${x} ${y} ${vw} ${vh}`;
  }

  return (
    <div className="absolute inset-0 bg-[#0c130f] [background-image:linear-gradient(rgba(79,227,161,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(79,227,161,0.05)_1px,transparent_1px)] [background-size:34px_34px]">
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full transition-[viewBox]"
      >
        {/* planned route — faint, dashed */}
        <polyline
          points={plannedPts}
          fill="none"
          stroke="rgba(79,227,161,0.28)"
          strokeWidth={1.5}
          strokeDasharray="6 7"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* actual breadcrumb — amber, thick */}
        {trail.length > 1 && (
          <polyline
            points={trailPts}
            fill="none"
            stroke="#f5b13b"
            strokeWidth={4}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* directional capture cones (memoized) */}
        {coneEls}

        {/* dock / home */}
        {dock && (
          <g transform={`translate(${dock.x} ${dock.y})`}>
            <circle r={11} fill="#0b0d0e" stroke="#ffffff" strokeWidth={2} />
            <path
              d="M-5 1 L0 -5 L5 1 M-3.5 -0.5 L-3.5 4 L3.5 4 L3.5 -0.5"
              fill="none"
              stroke="#eef2f3"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}

        {/* drone — CSS transform so it glides between flushes */}
        {drone && frame && (
          <g
            style={{
              transform: `translate(${drone.x}px, ${drone.y}px) rotate(${droneRot}deg)`,
              transition: 'transform 0.09s linear',
            }}
          >
            <circle r={16} fill="rgba(245,177,59,0.16)" />
            <path d="M0 -15 L-10 9 L0 4 L10 9 Z" fill="#f5b13b" stroke="#1a1205" strokeWidth={1} />
          </g>
        )}
      </svg>
    </div>
  );
}
