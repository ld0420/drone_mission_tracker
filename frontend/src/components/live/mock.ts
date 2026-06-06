// Static UI data for the live cockpit. (The telemetry / captures / terminal
// events are all real-time stream data — see useMissionStream — so the only
// static content here is the map legend.)

export interface LegendItem {
  label: string;
  /** pill background + text classes */
  pill: string;
  /** dot color class */
  dot: string;
}

export const LIVE_LEGEND: LegendItem[] = [
  { label: 'Drone · moving live', pill: 'bg-acc text-[#06241a]', dot: 'bg-[#06241a]' },
  { label: 'Actual breadcrumb', pill: 'bg-warn text-[#1a1205]', dot: 'bg-[#1a1205]' },
];
