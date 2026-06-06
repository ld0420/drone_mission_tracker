// Mock data for the Operations Overview dashboard — a static snapshot of the
// dock, fleet, recent missions, and the fake site mini-map layout.

import type { IconName } from '@/components/ui/Icon';
import type { MissionType } from '@/types/mission';

export interface StatusCard {
  icon: IconName;
  label: string;
  value: string;
  valueClass?: string;
  bar?: number;
  sub?: string;
}

export const STATUS: StatusCard[] = [
  { icon: 'home', label: 'Dock', value: 'Docked · Ready', valueClass: 'text-acc', sub: 'Sentinel X1 secured & charging' },
  { icon: 'battery', label: 'Battery', value: '100%', bar: 1, sub: '' },
  { icon: 'signal', label: 'Link / GPS', value: 'Strong', sub: '14 satellites · 4G uplink' },
  { icon: 'sun', label: 'Conditions', value: 'Good to fly', sub: 'Wind 6 kt · Vis 10 km · Clear' },
];

export interface FleetDrone {
  name: string;
  tag: string;
  serial: string;
  status: string;
  warn: boolean;
  batt: string;
  when: string;
}

export const FLEET: FleetDrone[] = [
  { name: 'Sentinel X1', tag: '', serial: 'SX1-A4F2-9921', status: 'Docked', warn: false, batt: '100%', when: 'flew today' },
  { name: 'Sentinel T2', tag: 'thermal', serial: 'ST2-7C13-4480', status: 'Docked', warn: false, batt: '92%', when: 'flew 3d ago' },
  { name: 'Sentinel X1', tag: 'unit 2', serial: 'SX1-9E07-1145', status: 'Maintenance', warn: true, batt: '64%', when: 'gimbal cal.' },
];

export interface RecentMission {
  id: string;
  type: MissionType;
  name: string;
  drone: string;
  dur: string;
  status: 'complete' | 'aborted';
  caps: number;
  ago: string;
}

export const RECENT: RecentMission[] = [
  { id: 'msn-grid-1', type: 'inspection', name: 'Solar Array Grid Inspection', drone: 'Sentinel X1', dur: '12m 31s', status: 'complete', caps: 144, ago: 'today' },
  { id: 'msn-patrol-2', type: 'patrol', name: 'Perimeter Security Patrol', drone: 'Sentinel X1', dur: '10m 42s', status: 'complete', caps: 122, ago: '4d' },
  { id: 'msn-thermal-3', type: 'thermal', name: 'Thermal Anomaly Sweep', drone: 'Sentinel T2', dur: '13m 38s', status: 'complete', caps: 140, ago: '6d' },
  { id: 'msn-aborted-5', type: 'aborted', name: 'Aborted Inspection', drone: 'Sentinel X1', dur: '6m 52s', status: 'aborted', caps: 79, ago: '1d' },
];

// ---- fake site mini-map layout (SVG viewBox units) ----
// Three solar-panel clusters with row counts (last has 2, per the design).
export const SITE_CLUSTERS = [
  { cx: 365, rows: 3 },
  { cx: 615, rows: 3 },
  { cx: 865, rows: 2 },
];
export const PANEL_W = 120;
export const ROW_Y = [185, 230, 275];
// Serpentine planned path weaving around the clusters: ⊓ over cluster 1, down,
// ⊔ under cluster 2, up, ⊓ over cluster 3.
export const SITE_PATH = 'M250 320 L250 150 L480 150 L480 320 L750 320 L750 150 L980 150 L980 320';
