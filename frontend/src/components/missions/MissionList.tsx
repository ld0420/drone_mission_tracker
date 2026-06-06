import { useEffect, useState } from 'react';
import { MissionRow, ROW_COLS } from './MissionRow';
import { useMissions } from '@/hook/useMissions';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { MISSION_COLUMNS } from './mock';

interface MissionListProps {
  onOpenMission: (missionId: string) => void;
  onPlan: () => void;
}

const PAGE = 10;

// Icon-only pager buttons (square) — local; not shared anywhere else.
const BTN_ICON =
  'grid place-items-center rounded-lg border border-line-2 bg-bg-2 p-2 text-t-hi transition hover:border-line-strong hover:bg-bg-3 disabled:pointer-events-none disabled:opacity-40';

const SKEL_CELL = 'skel h-3 rounded';

function SkeletonRow() {
  return (
    <div
      className={`pointer-events-none grid ${ROW_COLS} items-center gap-3.5 rounded-lg border border-line bg-bg-2 px-4 py-3.5`}
    >
      <div className="skel h-11 w-16 rounded-md" />
      <div>
        <div className="skel h-3.5 w-3/5 rounded" />
        <div className="skel mt-1.5 h-2.5 w-2/5 rounded" />
      </div>
      {/* one placeholder per remaining column (after Route + Mission) */}
      {MISSION_COLUMNS.slice(2).map((c) => (
        <div key={c} className={SKEL_CELL} />
      ))}
    </div>
  );
}

/**
 * Mission history — the operator's "what happened" home. Tailwind utilities on
 * the design tokens. Data layer is unchanged: the `useMissions` cursor infinite
 * query is drained to completion under the hood (proving the paginated
 * endpoint), then searched + paged client-side for a calm, scannable table.
 */
export function MissionList({ onOpenMission, onPlan }: MissionListProps) {
  const { data, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useMissions(20);

  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');

  // Drain remaining cursor pages so the full history is available to search/page.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    setPage(0);
  }, [q]);

  const all = isPending ? null : (data?.pages.flatMap((p) => p.items) ?? []);
  const site = all?.[0]?.site;

  const filtered = all
    ? all.filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q.toLowerCase()) ||
          m.drone.model.toLowerCase().includes(q.toLowerCase()),
      )
    : null;
  const pages = filtered ? Math.max(1, Math.ceil(filtered.length / PAGE)) : 1;
  const pageItems = filtered ? filtered.slice(page * PAGE, page * PAGE + PAGE) : [];

  const total = all ? all.length : 0;
  const aborted = all ? all.filter((m) => m.status === 'aborted').length : 0;

  return (
    <div className="absolute inset-0 flex flex-col bg-bg-0 [background-image:radial-gradient(80%_50%_at_80%_-10%,rgba(79,227,161,0.05),transparent_60%)]">
      <header className="flex-none border-b border-line px-10 pb-4 pt-8">
        <div className="mx-auto flex max-w-[1080px] items-end justify-between gap-5">
          <div>
            <div className="mb-2 text-2xs font-medium uppercase tracking-widest text-t-lo">
              {site ? `${site.name} · ${site.id}` : 'Greenfield Solar'}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Mission History</h1>
            <div className="mt-1 text-sm text-t-lo">
              {all ? (
                <>
                  <b className="font-semibold text-acc">{total}</b> missions logged
                  {aborted > 0 && (
                    <>
                      {' · '}
                      <span className="text-danger">{aborted} aborted</span>
                    </>
                  )}
                </>
              ) : (
                'Loading…'
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <label className="flex w-64 items-center gap-2.5 rounded-lg border border-line-2 bg-bg-1 px-3 py-2.5 text-t-lo transition-colors focus-within:border-acc-line">
              <Icon name="search" size={15} />
              <input
                placeholder="Search missions…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full border-0 bg-transparent text-sm text-t-hi outline-none placeholder:text-t-lo"
              />
            </label>
            <Button onClick={onPlan} className="whitespace-nowrap">
              <Icon name="plan" size={15} />
              Plan mission
            </Button>
          </div>
        </div>
      </header>

      <div className="scroll flex-1 px-10 pb-10 pt-4">
        <div className="mx-auto max-w-[1080px]">
          <div
            className={`grid ${ROW_COLS} items-center gap-3.5 px-4 pb-2.5 text-2xs uppercase tracking-widest text-t-lo`}
          >
            {MISSION_COLUMNS.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {!all ? (
              Array.from({ length: PAGE }).map((_, i) => <SkeletonRow key={i} />)
            ) : pageItems.length ? (
              pageItems.map((m) => (
                <MissionRow key={m.id} mission={m} onOpen={onOpenMission} />
              ))
            ) : (
              <div className="px-5 py-20 text-center text-t-lo">
                <div className="mx-auto mb-3.5 grid h-11 w-11 place-items-center rounded-xl bg-bg-2 text-t-mid">
                  <Icon name="search" size={22} />
                </div>
                <div className="font-semibold text-t-mid">No missions match “{q}”</div>
                <div className="mt-1 text-sm">
                  Try a different drone model or mission name.
                </div>
              </div>
            )}
          </div>

          {filtered && filtered.length > 0 && (
            <div className="mt-6 flex items-center justify-between px-1.5">
              <div className="text-xs text-t-lo">
                Showing {page * PAGE + 1}–
                {Math.min((page + 1) * PAGE, filtered.length)} of {filtered.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={BTN_ICON}
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <Icon name="chevL" size={16} />
                </button>
                <span className="min-w-14 text-center text-xs text-t-lo">
                  {page + 1} / {pages}
                </span>
                <button
                  className={BTN_ICON}
                  disabled={page >= pages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <Icon name="chevR" size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
