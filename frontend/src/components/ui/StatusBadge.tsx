import type { MissionStatus } from '@/types/mission';

interface StatusBadgeProps {
  status: MissionStatus;
}

/** Small pill that makes an aborted mission visibly distinct. */
export function StatusBadge({ status }: StatusBadgeProps) {
  const styles =
    status === 'aborted'
      ? 'bg-danger/15 text-danger ring-danger/30'
      : 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ring-1 ${styles}`}
    >
      {status}
    </span>
  );
}
