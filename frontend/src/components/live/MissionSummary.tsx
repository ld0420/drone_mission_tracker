import { Icon } from '@/components/ui/Icon';
import { formatDuration } from '@/utils/format';

interface MissionSummaryProps {
  aborted: boolean;
  abortReason?: string;
  missionName: string;
  drone: string;
  elapsed: number;
  captureCount: number;
  distanceM: number;
  onPlanAnother: () => void;
  onHistory: () => void;
  onReview: () => void;
}

/**
 * Terminal-event card. `mission_complete` → a clean wrap-up (check, totals,
 * plan-another / view-in-history). `mission_aborted` → the same shape, headlined
 * red with the human-readable `reason` surfaced in its own banner.
 */
export function MissionSummary({
  aborted,
  abortReason,
  missionName,
  drone,
  elapsed,
  captureCount,
  distanceM,
  onPlanAnother,
  onHistory,
  onReview,
}: MissionSummaryProps) {
  const dist =
    distanceM >= 1000 ? `${(distanceM / 1000).toFixed(2)} km` : `${Math.round(distanceM)} m`;

  const tint = aborted
    ? '[background-image:radial-gradient(90%_55%_at_50%_0%,rgba(255,107,94,0.1),transparent)]'
    : '[background-image:radial-gradient(90%_55%_at_50%_0%,rgba(79,227,161,0.1),transparent)]';

  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-black/75 p-6 backdrop-blur-sm">
      <div
        className={`w-[440px] max-w-full animate-[fadeIn_220ms_ease-out] rounded-2xl border bg-bg-1 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.6)] ${tint} ${
          aborted ? 'border-danger/20' : 'border-line'
        }`}
      >
        <div
          className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${
            aborted ? 'bg-danger-dim text-danger' : 'bg-acc-dim text-acc'
          }`}
        >
          <Icon name={aborted ? 'alert' : 'check'} size={26} />
        </div>

        <div className="mt-4 text-center text-3xl font-bold text-white/25">
          {aborted ? 'Mission aborted' : 'Mission complete'}
        </div>
        <div className="mt-1 text-center text-sm text-t-mid">
          {missionName} · {drone}
        </div>

        {aborted && abortReason && (
          <div className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-4">
            <div className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-widest text-danger">
              <Icon name="alert" size={13} />
              Abort reason
            </div>
            <div className="mt-1.5 text-sm leading-relaxed text-[#ffb3ab]">{abortReason}</div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-xl border border-line bg-bg-2/50">
          <Total label="Flight time" value={formatDuration(elapsed)} />
          <Total label="Captures" value={String(captureCount)} />
          <Total label="Distance" value={dist} />
        </div>

        {aborted ? (
          <button
            onClick={onReview}
            className="mt-5 w-full rounded-xl bg-acc py-3 text-sm font-semibold text-[#06241a] shadow-[0_2px_10px_rgba(79,227,161,0.25)] transition hover:bg-acc-bright"
          >
            Review &amp; re-fly
          </button>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={onPlanAnother}
              className="rounded-xl border border-line-2 bg-bg-2 py-3 text-sm font-semibold text-t-hi transition hover:border-line-strong hover:bg-bg-3"
            >
              Plan another
            </button>
            <button
              onClick={onHistory}
              className="rounded-xl bg-acc py-3 text-sm font-semibold text-[#06241a] shadow-[0_2px_10px_rgba(79,227,161,0.25)] transition hover:bg-acc-bright"
            >
              View in history
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-line px-3 py-4 text-center last:border-0">
      <div className="text-xl font-bold tabular-nums text-t-hi">{value}</div>
      <div className="mt-1 text-2xs uppercase tracking-widest text-t-lo">{label}</div>
    </div>
  );
}
