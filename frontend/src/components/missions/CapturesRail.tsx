import { useEffect, useRef } from 'react';
import type { Capture } from '@/types/mission';
import { useCaptures } from '@/hook/useCaptures';
import { imageUrl } from '@/api/client';
import { Icon } from '@/components/ui/Icon';

interface CapturesRailProps {
  missionId: string;
  selectedSeq: number | null;
  onOpen: (seq: number) => void;
}

function Thumb({
  cap,
  selected,
  onOpen,
}: {
  cap: Capture;
  selected: boolean;
  onOpen: (seq: number) => void;
}) {
  return (
    <div
      className={`relative aspect-[4/3] cursor-pointer overflow-hidden rounded-lg border-[1.5px] bg-bg-3 outline-none transition hover:z-[2] hover:scale-[1.04] ${
        selected
          ? 'z-[3] scale-[1.04] border-acc shadow-[0_0_0_3px_#4fe3a129]'
          : 'border-transparent'
      }`}
      role="button"
      tabIndex={0}
      data-seq={cap.seq}
      onClick={() => onOpen(cap.seq)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(cap.seq);
      }}
    >
      {/* loading="lazy" is the production-grade equivalent of the reference's
          scroll-windowing — the browser only fetches thumbs near the viewport. */}
      <img
        src={imageUrl(cap.image_id)}
        alt={`capture ${cap.seq}`}
        loading="lazy"
        draggable={false}
        className="h-full w-full object-cover opacity-0 transition-opacity duration-300"
        onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
      />
      <span className="absolute left-1 top-1 rounded bg-black/80 px-1 py-px text-2xs font-semibold text-white backdrop-blur-sm">
        {cap.seq}
      </span>
      <span className="absolute bottom-1 right-1 text-acc opacity-90">
        <Icon name="camera" size={12} />
      </span>
    </div>
  );
}

/**
 * Captures rail fed by the paginated /captures endpoint. The pages are drained
 * progressively (the "indexing" progress bar reflects loaded/total), while the
 * thumbnails themselves lazy-load their images. The selected thumb scrolls into
 * view when selection is driven from the map.
 */
export function CapturesRail({ missionId, selectedSeq, onOpen }: CapturesRailProps) {
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useCaptures(missionId);
  const gridRef = useRef<HTMLDivElement>(null);

  const captures = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const loaded = captures.length;
  const pct = total ? Math.round((loaded / total) * 100) : 0;

  // Drain remaining pages so the full capture index (and progress) completes.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Keep the selected thumb centered in the rail.
  useEffect(() => {
    if (selectedSeq == null) return;
    const cont = gridRef.current;
    if (!cont) return;
    requestAnimationFrame(() => {
      const el = cont.querySelector<HTMLElement>(`[data-seq="${selectedSeq}"]`);
      if (el) {
        cont.scrollTo({
          top: Math.max(0, el.offsetTop - cont.clientHeight / 2 + el.clientHeight / 2),
          behavior: 'smooth',
        });
      }
    });
  }, [selectedSeq, loaded]);

  return (
    <aside className="hidden min-h-0 flex-col border-l border-line bg-bg-4 md:flex">
      <div className="flex-none border-b border-line px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-tight">Captures</h3>
          <span className="text-xs text-acc">{total}</span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-bg-3">
          <i
            className="block h-full rounded-full bg-acc transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-2xs tracking-wider text-t-lo">
          <span>{loaded < total ? 'Indexing captures…' : 'All captures indexed'}</span>
          <span>
            {loaded} / {total}
          </span>
        </div>
      </div>

      <div className="scroll grid flex-1 grid-cols-3 content-start gap-2 p-3" ref={gridRef}>
        {captures.map((c) => (
          <Thumb
            key={c.image_id}
            cap={c}
            selected={c.seq === selectedSeq}
            onOpen={onOpen}
          />
        ))}
        {loaded < total &&
          Array.from({ length: Math.min(6, total - loaded) }).map((_, i) => (
            <div key={`s${i}`} className="skel aspect-[4/3] rounded-lg" />
          ))}
      </div>
    </aside>
  );
}
