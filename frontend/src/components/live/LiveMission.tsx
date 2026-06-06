import { useEffect, useState } from 'react';
import { useMissionStream } from '@/hook/useMissionStream';
import { useMissionDetail, useMissionPath } from '@/hook/useMissionDetail';
import { LiveMap } from './LiveMap';
import { TelemetryHUD } from './TelemetryHUD';
import { CapturePopin } from './CapturePopin';
import { MissionSummary } from './MissionSummary';
import { Icon } from '@/components/ui/Icon';
import { formatClock } from '@/utils/format';
import { LIVE_LEGEND } from './mock';

interface LiveMissionProps {
  runId: string;
  speed: number;
  templateId: string;
  onExit: () => void;
  onReview: () => void;
  onPlanAnother: () => void;
}

/** Approx ground distance along the breadcrumb, in metres. */
function trailDistance(trail: Array<[number, number]>): number {
  let d = 0;
  for (let i = 1; i < trail.length; i++) {
    const [lo1, la1] = trail[i - 1]!;
    const [lo2, la2] = trail[i]!;
    const dLat = (la2 - la1) * 111_000;
    const dLon = (lo2 - lo1) * 111_000 * Math.cos((la1 * Math.PI) / 180);
    d += Math.hypot(dLat, dLon);
  }
  return d;
}

/**
 * Live mission cockpit. Subscribes to the SSE stream (telemetry throttled to a
 * calm render cadence in the hook), and composes the tactical map with the
 * moving drone + breadcrumb, the HUD strip, capture pop-ins, and the terminal
 * summary. The planned route comes from the source template's /path.
 */
export function LiveMission({
  runId,
  speed,
  templateId,
  onExit,
  onReview,
  onPlanAnother,
}: LiveMissionProps) {
  const pathQuery = useMissionPath(templateId);
  const detail = useMissionDetail(templateId);
  const stream = useMissionStream(runId, speed);
  const [follow, setFollow] = useState(false);

  const terminal = stream.status === 'complete' || stream.status === 'aborted';
  const elapsed = stream.finalElapsed ?? stream.frame?.elapsed_s ?? 0;
  const name = detail.data?.name?.replace(/^LIVE:\s*/, '') ?? 'Live mission';

  // Let the rail's Live tab return to this run while it's in progress.
  const liveUrl = `/live/${runId}?speed=${speed}&template=${templateId}`;
  useEffect(() => {
    sessionStorage.setItem('mt:live', liveUrl);
  }, [liveUrl]);
  useEffect(() => {
    if (terminal) sessionStorage.removeItem('mt:live');
  }, [terminal]);

  const drone = detail.data?.drone?.model ?? 'Sentinel X1';
  const clearAnd = (fn: () => void) => () => {
    sessionStorage.removeItem('mt:live');
    fn();
  };
  const exit = clearAnd(onExit);

  return (
    <div className="absolute inset-0 bg-bg-0 p-3">
      <div className="relative h-full w-full overflow-hidden rounded-2xl border border-line">
        {pathQuery.data ? (
          <LiveMap
            plannedPath={pathQuery.data}
            frame={stream.frame}
            trail={stream.trail}
            captures={stream.captures}
            follow={follow}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[#0c130f] text-sm text-t-lo">
            {pathQuery.isError ? 'Could not load the flight plan.' : 'Establishing downlink…'}
          </div>
        )}

        {/* top bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] flex items-start justify-between gap-4 p-4 [background:linear-gradient(180deg,rgba(8,10,11,0.75),transparent)]">
          <div className="pointer-events-auto flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn-dim px-3 py-1 text-2xs font-semibold uppercase tracking-widest text-warn">
              <span className="h-1.5 w-1.5 animate-[pulse_1.4s_infinite] rounded-full bg-warn" />
              Live
            </span>
            <div>
              <div className="text-sm font-bold tracking-tight [text-shadow:0_1px_8px_rgba(0,0,0,0.7)]">
                {name}
              </div>
              <div className="text-2xs text-t-lo">{runId}</div>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2.5">
            <div className="text-xl font-semibold tabular-nums tracking-wide [text-shadow:0_1px_8px_rgba(0,0,0,0.7)]">
              {formatClock(elapsed)}
            </div>
            <span className="rounded-lg border border-line-2 bg-bg-1/70 px-2.5 py-1.5 text-2xs font-medium uppercase tracking-widest text-t-mid backdrop-blur">
              {speed}× Replay
            </span>
            <button
              onClick={() => setFollow((f) => !f)}
              title="Follow drone"
              className={`grid h-9 w-9 place-items-center rounded-lg transition ${
                follow
                  ? 'bg-acc text-[#06241a] shadow-[0_2px_10px_rgba(79,227,161,0.35)]'
                  : 'border border-line-2 bg-bg-1/70 text-t-mid backdrop-blur hover:text-t-hi'
              }`}
            >
              <Icon name="crosshair" size={16} />
            </button>
            <button
              onClick={exit}
              className="rounded-lg border border-line-2 bg-bg-1/70 px-3.5 py-1.5 text-sm font-semibold text-t-hi backdrop-blur transition hover:bg-bg-2"
            >
              Exit
            </button>
          </div>
        </div>

        {/* legend */}
        <div className="pointer-events-none absolute left-5 top-1/2 z-[1] flex -translate-y-1/2 flex-col gap-2">
          {LIVE_LEGEND.map((item) => (
            <span
              key={item.label}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-2xs font-semibold ${item.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
              {item.label}
            </span>
          ))}
        </div>

        {/* HUD */}
        <div className="absolute bottom-4 left-4 z-[1]">
          <TelemetryHUD frame={stream.frame} capturedCount={stream.captures.length} />
        </div>

        {/* capture pop-in */}
        <div className="absolute bottom-4 right-4 z-[1]">
          <CapturePopin captures={stream.captures} />
        </div>

        {stream.status === 'error' && !terminal && (
          <div className="absolute inset-x-0 top-20 z-[2] mx-auto w-fit rounded-lg border border-danger/30 bg-danger/15 px-4 py-2 text-sm text-danger backdrop-blur">
            Downlink lost — the run may have expired.
          </div>
        )}

        {terminal && (
          <MissionSummary
            aborted={stream.status === 'aborted'}
            abortReason={stream.abortReason}
            missionName={name}
            drone={drone}
            elapsed={elapsed}
            captureCount={stream.captures.length}
            distanceM={trailDistance(stream.trail)}
            onPlanAnother={clearAnd(onPlanAnother)}
            onHistory={exit}
            onReview={clearAnd(onReview)}
          />
        )}
      </div>
    </div>
  );
}
