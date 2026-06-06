// Status pill, ported from the design reference (util.jsx). Tailwind utilities;
// the `pulse` keyframe (live dot) still lives in the design stylesheet.

export type PillStatus = 'complete' | 'aborted' | 'live';

const LABEL: Record<PillStatus, string> = {
  complete: 'Complete',
  aborted: 'Aborted',
  live: 'Live',
};

const STYLES: Record<PillStatus, { wrap: string; dot: string }> = {
  complete: { wrap: 'text-acc bg-acc-dim border-acc-line', dot: 'bg-acc' },
  aborted: { wrap: 'text-danger bg-danger-dim border-danger-line', dot: 'bg-danger' },
  live: {
    wrap: 'text-warn bg-warn-dim border-warn/40',
    dot: 'bg-warn animate-[pulse_1.4s_infinite]',
  },
};

export function StatusPill({ status }: { status: PillStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-2 pr-2 text-2xs font-medium uppercase tracking-wider ${s.wrap}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {LABEL[status]}
    </span>
  );
}
