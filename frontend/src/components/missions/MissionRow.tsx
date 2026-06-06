import type { MissionSummary } from '@/types/mission';
import { StatusPill } from '@/components/ui/StatusPill';
import { RouteGlyph } from './RouteGlyph';
import { cameraNote, formatDate, formatDuration, formatTime } from '@/utils/format';

interface MissionRowProps {
  mission: MissionSummary;
  onOpen: (id: string) => void;
}

// Shared so the header (in MissionList) and the rows line up on the same tracks.
export const ROW_COLS =
  'grid-cols-[68px_minmax(220px,1fr)_120px_120px_120px_120px]';

/** One mission history row. Aborted rows get a red left bar + border accent. */
export function MissionRow({ mission: m, onOpen }: MissionRowProps) {
  const aborted = m.status === 'aborted';
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(m.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(m.id);
      }}
      className={`relative grid ${ROW_COLS} cursor-pointer items-center gap-3.5 overflow-hidden rounded-lg border bg-bg-2 px-4 py-3.5 transition-all duration-150 hover:-translate-y-px hover:bg-bg-4 hover:shadow-[0_1px_2px_rgba(0,0,0,0.4)] ${
        aborted
          ? "border-danger/30 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-danger before:content-['']"
          : 'border-line hover:border-line-2'
      }`}
    >
      <div className="h-11 w-16 overflow-hidden rounded-md border border-line bg-bg-4">
        <RouteGlyph type={m.type} aborted={aborted} />
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm font-semibold tracking-tight">{m.name}</div>
        <div className="mt-1 flex items-center gap-2">
          <StatusPill status={m.status} />
          <span className="truncate text-2xs text-t-lo">{cameraNote(m.type)}</span>
        </div>
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm text-t-mid">{m.drone.model}</div>
        <div className="mt-0.5 text-2xs text-t-lo">{m.drone.serial}</div>
      </div>

      <Cell big={formatDuration(m.duration_seconds)} small="duration" />
      <Cell big={String(m.capture_count)} small="photos" />

      <div>
        <div className="text-sm text-t-mid">{formatDate(m.started_at)}</div>
        <div className="mt-0.5 text-2xs text-t-lo">
          {formatTime(m.started_at)} · {m.waypoint_count} wp
        </div>
      </div>
    </div>
  );
}

function Cell({ big, small }: { big: string; small: string }) {
  return (
    <div>
      <div className="text-sm tabular-nums text-t-hi">{big}</div>
      <div className="mt-0.5 text-2xs uppercase tracking-wider text-t-lo">{small}</div>
    </div>
  );
}
