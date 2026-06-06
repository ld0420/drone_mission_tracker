import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { RouteGlyph } from '@/components/missions/RouteGlyph';
import {
  FLEET,
  PANEL_W,
  RECENT,
  ROW_Y,
  SITE_CLUSTERS,
  SITE_PATH,
  STATUS,
} from './mock';

/**
 * Operations Overview — the home dashboard. Its data is FAKE / mock (see
 * ./mock): a static snapshot of the dock, fleet, recent missions, and weekly
 * stats. The action buttons route into the real surfaces.
 */
export function OperationsOverview() {
  const navigate = useNavigate();
  const goPlan = () => navigate('/plan');
  const goHistory = () => navigate('/missions');

  return (
    <div className="absolute inset-0 overflow-y-auto bg-bg-0 [background-image:radial-gradient(60%_40%_at_80%_-10%,rgba(79,227,161,0.05),transparent_60%)]">
      <div className="mx-auto max-w-[1320px] p-8">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Operations Overview</h1>
            <div className="mt-1 text-sm text-t-lo">
              Thursday, May 28 2026 · 08:14 local · dock operational
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-acc-line bg-acc-dim px-3 py-1.5 text-2xs font-medium uppercase tracking-widest text-acc">
              <span className="h-1.5 w-1.5 rounded-full bg-acc" />
              All systems nominal
            </span>
            <Button variant="outline" onClick={goHistory}>
              <Icon name="grid" size={15} />
              History
            </Button>
            <Button onClick={goPlan}>
              <Icon name="plan" size={15} />
              Plan mission
            </Button>
          </div>
        </div>

        {/* status cards */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STATUS.map((s) => (
            <div key={s.label} className="rounded-xl border border-line bg-bg-1 p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-bg-3 text-t-mid">
                  <Icon name={s.icon} size={16} />
                </span>
                <span className="text-2xs font-medium uppercase tracking-widest text-t-lo">
                  {s.label}
                </span>
              </div>
              <div className={`text-xl font-bold ${s.valueClass ?? 'text-t-hi'}`}>{s.value}</div>
              {s.bar ? (
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-bg-3">
                  <div className="h-full w-full rounded-full bg-acc" />
                </div>
              ) : (
                <div className="mt-2 text-xs text-t-lo">{s.sub}</div>
              )}
            </div>
          ))}
        </div>

        {/* main grid */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Site" action="Open map →" onAction={goHistory} className="lg:col-span-2">
            <SiteMap />
          </Panel>

          <Panel title="Fleet" action="Manage →">
            <div>
              {FLEET.map((f) => (
                <div
                  key={f.serial}
                  className="flex items-center gap-3 border-b border-line py-3 last:border-0"
                >
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-line bg-bg-2 text-t-mid">
                    <Icon name="drone" size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {f.name}
                      {f.tag && <span className="font-normal text-t-lo"> · {f.tag}</span>}
                    </div>
                    <div className="text-2xs text-t-lo">{f.serial}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`flex items-center justify-end gap-1.5 text-sm ${f.warn ? 'text-warn' : 'text-acc'}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${f.warn ? 'bg-warn' : 'bg-acc'}`} />
                      {f.status}
                    </div>
                    <div className="text-2xs text-t-lo">
                      {f.batt} · {f.when}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Recent missions"
            action="View all →"
            onAction={goHistory}
            className="lg:col-span-2"
          >
            <div>
              {RECENT.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/missions/${m.id}`)}
                  className="flex w-full items-center gap-3 rounded-md border-b border-line px-2 py-3 text-left transition last:border-0 hover:bg-white/[0.03]"
                >
                  <span className="h-9 w-12 flex-none overflow-hidden rounded-md border border-line bg-bg-3">
                    <RouteGlyph type={m.type} aborted={m.status === 'aborted'} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{m.name}</div>
                    <div className="text-2xs text-t-lo">
                      {m.drone} · {m.dur}
                    </div>
                  </div>
                  <StatusPill status={m.status} />
                  <div className="w-20 text-right text-xs tabular-nums text-t-lo">
                    {m.caps} · {m.ago}
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <section className="flex flex-col gap-4 rounded-xl border border-line bg-bg-1 p-5">
            <div className="rounded-lg border border-danger/30 bg-danger/10 p-4">
              <div className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-widest text-danger">
                <Icon name="alert" size={14} />
                Attention
              </div>
              <div className="mt-2 text-sm text-[#ffb3ab]">
                1 mission aborted this week (low battery RTL).{' '}
                <button
                  onClick={() => navigate('/missions/msn-aborted-5')}
                  className="font-semibold underline hover:text-danger"
                >
                  Review &amp; re-fly →
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-line">
              {[
                ['7', 'Missions'],
                ['921', 'Captures'],
                ['1h 24m', 'Flight'],
              ].map(([v, k]) => (
                <div key={k} className="border-r border-line px-2 py-4 text-center last:border-0">
                  <div className="text-xl font-bold tabular-nums">{v}</div>
                  <div className="mt-1 text-2xs uppercase tracking-widest text-t-lo">{k}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="outline" onClick={goHistory}>
                Review history
              </Button>
              <Button onClick={goPlan}>Plan mission</Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  action,
  onAction,
  className,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-line bg-bg-1 p-5 ${className ?? ''}`}>
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {action && (
          <button onClick={onAction} className="text-xs text-t-mid transition hover:text-acc">
            {action}
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

/** Fake site mini-map: grid, solar-panel clusters, dock marker, status chips.
 *  Layout data lives in ./mock. */
function SiteMap() {
  return (
    <div className="relative h-[320px] overflow-hidden rounded-lg border border-line bg-[#0c130f] [background-image:radial-gradient(70%_60%_at_15%_0%,rgba(79,227,161,0.06),transparent_60%)]">
      {/* grid */}
      <div className="absolute inset-0 [background-image:linear-gradient(rgba(79,227,161,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(79,227,161,0.06)_1px,transparent_1px)] [background-size:30px_30px]" />

      <svg
        viewBox="0 0 1120 440"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
      >
        {/* dashed planned flight path */}
        <path
          d={SITE_PATH}
          fill="none"
          stroke="rgba(79,227,161,0.45)"
          strokeWidth={2}
          strokeDasharray="7 9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* panel rows */}
        {SITE_CLUSTERS.map((c) =>
          ROW_Y.slice(0, c.rows).map((y) => (
            <rect
              key={`${c.cx}-${y}`}
              x={c.cx - PANEL_W / 2}
              y={y - 15}
              width={PANEL_W}
              height={30}
              rx={5}
              fill="rgba(79,227,161,0.15)"
              stroke="rgba(79,227,161,0.5)"
              strokeWidth={1.5}
            />
          )),
        )}

        {/* dock — at the path origin */}
        <g transform="translate(250 320)">
          <circle r={14} fill="#0b0d0e" stroke="#ffffff" strokeWidth={2.5} />
          <circle r={3} fill="#eef2f3" />
        </g>
      </svg>

      <div className="absolute left-3 top-3 rounded-md border border-line-2 bg-bg-0/70 px-2.5 py-1 font-mono text-2xs uppercase tracking-wider text-t-mid backdrop-blur-sm">
        Greenfield Solar · 33.2530, -91.6643 · 240 ac
      </div>

      <div className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-md border border-line-2 bg-bg-0/70 px-2.5 py-1 font-mono text-2xs text-t-mid backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-acc" />
        Dock · last flight 2h ago
      </div>
    </div>
  );
}
