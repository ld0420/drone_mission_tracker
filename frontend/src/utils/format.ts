// Small, dependency-free formatting helpers shared across mission surfaces.
// Mirrors the design reference (util.jsx) so copy + number formatting match.

import type { MissionType } from '@/types/mission';

/** Seconds → "12m 05s" (or "1h 05m" past an hour). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  }
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}

/** Seconds → "12:05" (compact clock, for HUD / metadata). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** ISO → "May 26, 2026". */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** ISO → "14:12" (24h). */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** ISO → "May 28, 13:15" (compact date+time). */
export function formatStartedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Degrees → 8-point compass label, e.g. 90 → "E". */
export function compass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8]!;
}

/** Short camera/pattern note per mission type (the catalog descriptions). */
export function cameraNote(type: MissionType): string {
  switch (type) {
    case 'patrol':
      return 'Outward camera · perimeter';
    case 'thermal':
      return 'Inward orbit · thermal';
    case 'health_check':
      return 'Low-altitude serpentine';
    case 'aborted':
      return 'Grid inspection · low battery';
    case 'inspection':
    default:
      return 'Nadir grid · S-pattern';
  }
}
