// Mock conversation data for the planner — the "fake replies" the brief asks
// for. All scripted copy (system responses) and quick-reply suggestions live
// here, separate from the flow logic in ChatPlanner.

export interface PlanTemplate {
  id: string;
  label: string;
  drone: string;
  serial: string;
  pattern: string;
  alt: number;
  wp: number;
  cap: number;
  est: string;
  camera: string;
}

export interface Chip {
  label: string;
  value: string;
}

/** Mission templates the operator can choose. `id` maps to a real backend mission. */
export const TEMPLATES: Record<string, PlanTemplate> = {
  inspection: { id: 'msn-grid-1', label: 'Solar Array Grid Inspection', drone: 'Sentinel X1', serial: 'SX1-A4F2-9921', pattern: 'S-pattern nadir grid', alt: 35, wp: 148, cap: 144, est: '12m 31s', camera: 'Nadir RGB + IR' },
  patrol: { id: 'msn-patrol-2', label: 'Perimeter Security Patrol', drone: 'Sentinel X1', serial: 'SX1-A4F2-9921', pattern: 'Rectangular perimeter loop', alt: 50, wp: 126, cap: 122, est: '10m 42s', camera: 'Outward RGB' },
  thermal: { id: 'msn-thermal-3', label: 'Thermal Anomaly Sweep', drone: 'Sentinel T2', serial: 'ST2-7C13-4480', pattern: 'Inward hot-spot orbits', alt: 55, wp: 144, cap: 140, est: '13m 38s', camera: 'Radiometric IR' },
  health: { id: 'msn-health-4', label: 'Routine Site Health Check', drone: 'Sentinel X1', serial: 'SX1-A4F2-9921', pattern: 'Dense serpentine grid', alt: 28, wp: 178, cap: 174, est: '17m 24s', camera: 'Nadir RGB' },
  aborted: { id: 'msn-aborted-5', label: 'Aborted Inspection (Low Battery)', drone: 'Sentinel X1', serial: 'SX1-A4F2-9921', pattern: 'S-pattern grid · RTL test', alt: 35, wp: 83, cap: 79, est: '6m 52s', camera: 'Nadir RGB + IR' },
};

// ---- quick-reply suggestions per stage ----
export const TYPE_CHIPS: Chip[] = [
  { label: 'Inspection grid', value: 'inspection' },
  { label: 'Security patrol', value: 'patrol' },
  { label: 'Thermal sweep', value: 'thermal' },
  { label: 'Health check', value: 'health' },
  { label: 'Aborted inspection', value: 'aborted' },
];
export const SITE_CHIPS: Chip[] = [
  { label: 'Draft the plan', value: 'draft' },
  { label: 'Pick another type', value: 'back' },
];
export const REVIEW_CHIPS: Chip[] = [
  { label: 'Looks good — arm it', value: 'arm' },
  { label: 'Adjust altitude', value: 'alt' },
];
export const ALT_CHIPS: Chip[] = [
  { label: '25 m', value: '25' },
  { label: '35 m', value: '35' },
  { label: '45 m', value: '45' },
  { label: '60 m', value: '60' },
];
export const RETRY_CHIPS: Chip[] = [{ label: 'Retry start', value: 'arm' }];

export const PREFLIGHT_CHECKS = [
  'GPS lock · 14 satellites',
  'Battery 100% · 4 cells nominal',
  'Geofence & RTL armed',
  'Camera & gimbal calibrated',
];

// ---- scripted system responses ----
export const REPLIES = {
  greeting:
    "Operator online. I'll help you set up a flight at Greenfield Solar. What kind of mission are we flying today?",
  typeAck: (t: PlanTemplate) =>
    `Good copy — ${t.label}. Launch point is the active dock at Greenfield Solar. Camera: ${t.camera}. Want me to draft the plan?`,
  back: 'No problem. What are we flying instead?',
  plan: (t: PlanTemplate, alt: number) =>
    `Here's the plan. ${t.label.split(' ').slice(0, 3).join(' ')} flies a ${t.pattern.toLowerCase()} at ${alt} m AGL on the ${t.drone}.`,
  altPrompt: 'Sure — what cruise altitude do you want?',
  preflight: 'Pre-flight checks running…',
  arming: (t: PlanTemplate) =>
    `Arming ${t.drone} and uploading ${t.wp} waypoints… you have the aircraft.`,
  launchFail: 'Launch failed — could not reach the dock. Try again.',
};
