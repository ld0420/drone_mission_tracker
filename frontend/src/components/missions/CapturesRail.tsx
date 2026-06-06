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
      className={`thumb${selected ? ' selected' : ''}`}
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
        onLoad={(e) => e.currentTarget.classList.add('loaded')}
      />
      <span className="seq">{cap.seq}</span>
      <span className="hd">
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
      const el = cont.querySelector<HTMLElement>(`.thumb[data-seq="${selectedSeq}"]`);
      if (el) {
        cont.scrollTo({
          top: Math.max(0, el.offsetTop - cont.clientHeight / 2 + el.clientHeight / 2),
          behavior: 'smooth',
        });
      }
    });
  }, [selectedSeq, loaded]);

  return (
    <aside className="cap-rail">
      <div className="cap-head">
        <div className="cap-head-top">
          <h3>Captures</h3>
          <span className="count">{total}</span>
        </div>
        <div className="cap-progress">
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="cap-progress-label">
          <span>{loaded < total ? 'Indexing captures…' : 'All captures indexed'}</span>
          <span>
            {loaded} / {total}
          </span>
        </div>
      </div>

      <div className="cap-grid scroll" ref={gridRef}>
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
            <div key={`s${i}`} className="thumb-skel skel" />
          ))}
      </div>
    </aside>
  );
}
