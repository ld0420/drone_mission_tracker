import type { MissionType } from '@/types/mission';

// A tiny SVG glyph of the flight pattern for the list's route-thumb cell.
// The list endpoint doesn't carry waypoint geometry, so we draw a
// representative normalized pattern per mission type rather than fetch each
// path. Ported from the design's RouteGlyph (util.jsx), which took real
// preview points; the SVG rendering is identical.

type Pt = [number, number];

function serpentine(rows: number): Pt[] {
  const pts: Pt[] = [];
  for (let r = 0; r < rows; r++) {
    const y = rows === 1 ? 0.5 : r / (rows - 1);
    const [a, b] = r % 2 === 0 ? [0, 1] : [1, 0];
    pts.push([a, y], [b, y]);
  }
  return pts;
}

function rectangle(): Pt[] {
  return [
    [0.12, 0.18],
    [0.88, 0.18],
    [0.88, 0.82],
    [0.12, 0.82],
    [0.12, 0.18],
  ];
}

function orbits(): Pt[] {
  const pts: Pt[] = [];
  const centers: Pt[] = [
    [0.32, 0.4],
    [0.62, 0.58],
    [0.78, 0.34],
  ];
  for (const [cx, cy] of centers) {
    for (let i = 0; i <= 8; i++) {
      const t = (i / 8) * Math.PI * 2;
      pts.push([cx + Math.cos(t) * 0.12, cy + Math.sin(t) * 0.16]);
    }
  }
  return pts;
}

function abortedPath(): Pt[] {
  // half a serpentine, then a straight emergency RTL back to the dock corner
  const pts = serpentine(3).slice(0, 5);
  pts.push([0, 0]);
  return pts;
}

function buildPreview(type: MissionType): Pt[] {
  switch (type) {
    case 'patrol':
      return rectangle();
    case 'thermal':
      return orbits();
    case 'health_check':
      return serpentine(5);
    case 'aborted':
      return abortedPath();
    case 'inspection':
    default:
      return serpentine(4);
  }
}

export function RouteGlyph({
  type,
  aborted,
}: {
  type: MissionType;
  aborted?: boolean;
}) {
  const preview = buildPreview(type);
  const W = 64;
  const H = 44;
  const pad = 6;
  const pts = preview.map(
    ([x, y]) => [pad + x * (W - pad * 2), pad + y * (H - pad * 2)] as Pt,
  );
  const d = pts
    .map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1))
    .join(' ');
  const col = aborted ? '#ff6b5e' : '#4fe3a1';
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full">
      <path
        d={d}
        fill="none"
        stroke={col}
        strokeWidth={1.3}
        strokeOpacity={0.85}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={first[0]} cy={first[1]} r={1.8} fill={col} />
      <circle cx={last[0]} cy={last[1]} r={1.8} fill={aborted ? '#ff6b5e' : '#fff'} />
    </svg>
  );
}
