import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { MissionPath, MissionStatus } from '@/types/mission';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

const ACC = '#4fe3a1';
const DANGER = '#ff6b5e';

interface MissionMapProps {
  path: MissionPath | undefined;
  status: MissionStatus;
  selectedSeq: number | null;
  onSelectCapture: (seq: number) => void;
}

const SRC = { path: 'flight-path', wp: 'waypoints', cap: 'captures', dock: 'dock' } as const;
const LYR = {
  glow: 'flight-path-glow',
  path: 'flight-path-line',
  wp: 'waypoint-dots',
  cap: 'capture-cones',
  sel: 'capture-selected',
  dock: 'dock-marker',
} as const;

/**
 * Site map for a past mission. All geometry comes pre-shaped from
 * /missions/:id/path, rendered with GL sources + layers (a single symbol
 * layer draws every directional cone) so it stays smooth at the dense
 * missions' ~190-marker scale. Cone/selection visuals adapt the design
 * reference's MapView (Leaflet → Mapbox icon-rotate symbol layers).
 */
export function MissionMap({
  path,
  status,
  selectedSeq,
  onSelectCapture,
}: MissionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelectCapture);
  onSelectRef.current = onSelectCapture;
  const aborted = status === 'aborted';

  // --- init map once -------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || !TOKEN) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-91.664321, 33.252968],
      zoom: 15,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;
    map.on('load', () => {
      map.resize();
      setReady(true);
    });
    map.on('error', (e) => {
      console.error('[MissionMap] mapbox error:', e.error?.message ?? e);
    });
    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // --- add / update geometry ----------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !path) return;

    ensureImages(map);
    const coneBase = aborted ? 'cone-r' : 'cone-g';
    const coneActive = aborted ? 'cone-r-active' : 'cone-g-active';
    const lineColor = aborted ? DANGER : ACC;

    upsertGeoJson(map, SRC.path, path.path);
    upsertGeoJson(map, SRC.wp, path.waypoints);
    upsertGeoJson(map, SRC.cap, path.captures);
    upsertGeoJson(map, SRC.dock, dockCollection(path));

    if (!map.getLayer(LYR.glow)) {
      map.addLayer({
        id: LYR.glow,
        type: 'line',
        source: SRC.path,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': lineColor, 'line-width': 8, 'line-opacity': 0.16 },
      });
      map.addLayer({
        id: LYR.path,
        type: 'line',
        source: SRC.path,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': lineColor, 'line-width': 2.4, 'line-opacity': 0.92 },
      });
      // Transit waypoints = quiet dots; photo stops are shown as cones, the
      // dock (takeoff/RTL) as its own marker — so the three are distinct.
      map.addLayer({
        id: LYR.wp,
        type: 'circle',
        source: SRC.wp,
        filter: ['==', ['get', 'kind'], 'transit'],
        paint: {
          'circle-radius': 1.8,
          'circle-color': '#eef2f3',
          'circle-opacity': 0.45,
        },
      });
      map.addLayer({
        id: LYR.cap,
        type: 'symbol',
        source: SRC.cap,
        layout: {
          'icon-image': coneBase,
          'icon-rotate': ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.7, 17, 1],
        },
      });
      map.addLayer({
        id: LYR.dock,
        type: 'symbol',
        source: SRC.dock,
        layout: { 'icon-image': 'dock', 'icon-allow-overlap': true, 'icon-size': 1 },
      });
      map.addLayer({
        id: LYR.sel,
        type: 'symbol',
        source: SRC.cap,
        filter: ['==', ['get', 'seq'], -1],
        layout: {
          'icon-image': coneActive,
          'icon-rotate': ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.85, 17, 1.25],
        },
      });

      map.on('click', LYR.cap, (e) => {
        const seq = e.features?.[0]?.properties?.seq;
        if (typeof seq === 'number') onSelectRef.current(seq);
      });
      const setCursor = (c: string) => () => {
        map.getCanvas().style.cursor = c;
      };
      map.on('mouseenter', LYR.cap, setCursor('pointer'));
      map.on('mouseleave', LYR.cap, setCursor(''));
    } else {
      // mission (and possibly its color) changed — re-point styling
      map.setPaintProperty(LYR.glow, 'line-color', lineColor);
      map.setPaintProperty(LYR.path, 'line-color', lineColor);
      map.setLayoutProperty(LYR.cap, 'icon-image', coneBase);
      map.setLayoutProperty(LYR.sel, 'icon-image', coneActive);
    }

    map.fitBounds(path.bounds, { padding: 70, duration: 0, maxZoom: 18 });
  }, [ready, path, aborted]);

  // --- selection sync ------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer(LYR.sel)) return;
    map.setFilter(LYR.sel, ['==', ['get', 'seq'], selectedSeq ?? -1]);

    const feat = path?.captures.features.find((f) => f.properties.seq === selectedSeq);
    if (feat) {
      const c = feat.geometry.coordinates;
      // pan only if the selected cone is near/over the edge of the viewport
      const bounds = map.getBounds();
      if (bounds && !bounds.contains(c)) {
        map.easeTo({ center: c, duration: 400 });
      }
    }
  }, [selectedSeq, ready, path]);

  if (!TOKEN) {
    return (
      <div className="map-root grid place-items-center p-6 text-center text-sm">
        <div>
          <p style={{ color: 'var(--t-mid)' }}>Mapbox token missing</p>
          <p className="mt-1" style={{ color: 'var(--t-lo)' }}>
            Add <code style={{ color: 'var(--acc)' }}>VITE_MAPBOX_TOKEN</code> to{' '}
            <code>frontend/.env.local</code> to render the site map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-root">
      <div ref={containerRef} className="map-canvas" />
      <div className="map-vignette" />
    </div>
  );
}

// --- helpers ---------------------------------------------------------------

function upsertGeoJson(
  map: mapboxgl.Map,
  id: string,
  data: GeoJSON.Feature | GeoJSON.FeatureCollection,
) {
  const src = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
  if (src) src.setData(data as GeoJSON.GeoJSON);
  else map.addSource(id, { type: 'geojson', data: data as GeoJSON.GeoJSON });
}

/** Single-point collection at the dock (first ground waypoint). */
function dockCollection(path: MissionPath): GeoJSON.FeatureCollection {
  const ground =
    path.waypoints.features.find((f) => f.properties.kind === 'ground') ??
    path.waypoints.features[0];
  return {
    type: 'FeatureCollection',
    features: ground
      ? [{ type: 'Feature', properties: {}, geometry: ground.geometry }]
      : [],
  };
}

/** Register all marker icons once per map instance. */
function ensureImages(map: mapboxgl.Map) {
  const defs: Array<[string, ImageData]> = [
    ['cone-g', coneImage(ACC, false)],
    ['cone-g-active', coneImage(ACC, true)],
    ['cone-r', coneImage(DANGER, false)],
    ['cone-r-active', coneImage(DANGER, true)],
    ['dock', dockImage()],
  ];
  for (const [name, img] of defs) {
    if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 });
  }
}

/**
 * Directional view-cone: a narrow wedge fanning from the capture point toward
 * the camera heading, with a dot at the precise point. Selected variant adds a
 * halo + ring. Drawn at 2× for crispness (addImage pixelRatio: 2).
 */
function coneImage(color: string, active: boolean): ImageData {
  const S = active ? 56 : 36;
  const R = 2;
  const canvas = document.createElement('canvas');
  canvas.width = S * R;
  canvas.height = S * R;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(R, R);
  const c = S / 2;
  const top = 5;
  const spread = active ? 12 : 8;

  if (active) {
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.fillStyle = rgba(color, 0.08);
    ctx.fill();
    ctx.strokeStyle = rgba(color, 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.lineTo(c - spread, top);
  ctx.lineTo(c + spread, top);
  ctx.closePath();
  ctx.fillStyle = rgba(color, active ? 0.5 : 0.3);
  ctx.fill();
  ctx.strokeStyle = rgba(color, active ? 1 : 0.85);
  ctx.lineWidth = active ? 2 : 1.4;
  ctx.lineJoin = 'round';
  ctx.stroke();

  if (active) {
    ctx.beginPath();
    ctx.arc(c, c, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = rgba(color, 0.25);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c, c, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(c, c, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  return ctx.getImageData(0, 0, S * R, S * R);
}

/** Dock marker — a ringed circle with a home glyph (takeoff / RTL). */
function dockImage(): ImageData {
  const S = 28;
  const R = 2;
  const canvas = document.createElement('canvas');
  canvas.width = S * R;
  canvas.height = S * R;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(R, R);
  ctx.beginPath();
  ctx.arc(14, 14, 12, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(11,13,14,0.9)';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = '#eef2f3';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(8, 15);
  ctx.lineTo(14, 8);
  ctx.lineTo(20, 15);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(10.5, 13.5);
  ctx.lineTo(10.5, 19);
  ctx.lineTo(17.5, 19);
  ctx.lineTo(17.5, 13.5);
  ctx.stroke();
  return ctx.getImageData(0, 0, S * R, S * R);
}

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
