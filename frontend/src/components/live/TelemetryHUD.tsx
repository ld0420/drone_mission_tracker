import type { ReactNode } from 'react';
import type { TelemetryEvent } from '@/types/mission';
import { Icon, type IconName } from '@/components/ui/Icon';
import { compass } from '@/utils/format';

interface TelemetryHUDProps {
  frame: TelemetryEvent | null;
  capturedCount: number;
}

/**
 * Heads-up display strip: battery (+ bar), altitude, signal, heading, captured
 * count. Driven by the throttled `frame` from the stream hook, so the readouts
 * update at a calm ~12 Hz rather than jittering on every telemetry packet.
 */
export function TelemetryHUD({ frame, capturedCount }: TelemetryHUDProps) {
  const batt = frame ? Math.round(frame.battery_pct) : 0;
  return (
    <div className="pointer-events-auto inline-flex items-stretch gap-1 rounded-2xl border border-line bg-bg-1/85 p-1.5 backdrop-blur">
      <Cell icon="battery" label="Battery" emphasis>
        <div className="text-xl font-bold tabular-nums text-acc">{frame ? `${batt}%` : '—'}</div>
        <div className="mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-bg-3">
          <div
            className={`h-full rounded-full transition-[width] duration-200 ${batt < 25 ? 'bg-danger' : 'bg-acc'}`}
            style={{ width: `${batt}%` }}
          />
        </div>
      </Cell>
      <Cell icon="arrowUp" label="Altitude">
        <div className="text-lg font-semibold tabular-nums text-t-hi">
          {frame ? `${Math.round(frame.alt)} m` : '—'}
        </div>
      </Cell>
      <Cell icon="signal" label="Signal">
        <div className="text-lg font-semibold tabular-nums text-t-hi">
          {frame ? `${Math.round(frame.signal)}%` : '—'}
        </div>
      </Cell>
      <Cell icon="clock" label="Heading">
        <div className="text-lg font-semibold tabular-nums text-t-hi">
          {frame ? `${Math.round(frame.heading)}° ${compass(frame.heading)}` : '—'}
        </div>
      </Cell>
      <Cell icon="camera" label="Captured" emphasis>
        <div className="text-xl font-bold tabular-nums text-acc">{capturedCount}</div>
      </Cell>
    </div>
  );
}

function Cell({
  icon,
  label,
  emphasis,
  children,
}: {
  icon: IconName;
  label: string;
  emphasis?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-2.5">
      <span
        className={`grid h-9 w-9 flex-none place-items-center rounded-lg ${
          emphasis ? 'bg-acc-dim text-acc' : 'bg-bg-3 text-t-lo'
        }`}
      >
        <Icon name={icon} size={16} />
      </span>
      <div>
        <div className="text-2xs font-medium uppercase tracking-widest text-t-lo">{label}</div>
        {children}
      </div>
    </div>
  );
}
