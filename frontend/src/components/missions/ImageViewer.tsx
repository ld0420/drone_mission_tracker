import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { imageUrl } from '@/api/client';
import { Icon } from '@/components/ui/Icon';
import { compass } from '@/utils/format';

/** The complete, seq-ordered capture list the viewer needs. */
export interface ViewerCapture {
  seq: number;
  image_id: string;
  heading: number;
  alt: number;
  waypoint_index: number;
  lat: number;
  lon: number;
}

interface ImageViewerProps {
  captures: ViewerCapture[];
  selectedSeq: number | null;
  missionName: string;
  onSelectSeq: (seq: number) => void;
  onClose: () => void;
}

const VNAV =
  'absolute top-1/2 z-[1] grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-line-2 bg-[#171b1e]/80 text-t-hi backdrop-blur-[8px] transition hover:scale-[1.06] hover:bg-bg-3 disabled:pointer-events-none disabled:opacity-30';

/**
 * Fullscreen capture viewer. Steps through every capture via arrow keys,
 * on-screen buttons, swipe, or the filmstrip; each step calls onSelectSeq so
 * the map cone + rail thumb stay in sync. Neighbours preload for instant nav.
 */
export function ImageViewer({
  captures,
  selectedSeq,
  missionName,
  onSelectSeq,
  onClose,
}: ImageViewerProps) {
  const idx = captures.findIndex((c) => c.seq === selectedSeq);
  const current = idx >= 0 ? captures[idx] : undefined;
  const filmRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (delta: number) => {
      const ni = idx + delta;
      if (ni < 0 || ni >= captures.length) return;
      const target = captures[ni];
      if (target) onSelectSeq(target.seq);
    },
    [idx, captures, onSelectSeq],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  // Preload neighbours + keep the active filmstrip thumb centered.
  useEffect(() => {
    [idx - 1, idx + 1].forEach((i) => {
      const c = captures[i];
      if (c) {
        const img = new Image();
        img.src = imageUrl(c.image_id);
      }
    });
    const film = filmRef.current;
    const el = film?.querySelector<HTMLElement>(`[data-i="${idx}"]`);
    if (film && el) {
      film.scrollTo({
        left: el.offsetLeft - film.clientWidth / 2 + el.clientWidth / 2,
        behavior: 'smooth',
      });
    }
  }, [idx, captures]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex animate-[fadeIn_0.2s_ease-out] flex-col bg-[#060809]/95 backdrop-blur-[8px]"
      onTouchStart={(e) => (touchX.current = e.touches[0]!.clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0]!.clientX - touchX.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="z-[2] flex flex-none items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3.5">
          <button
            className="grid h-9 w-9 place-items-center rounded-full border border-line-2 bg-[#171b1e]/80 text-t-hi backdrop-blur-[8px] transition hover:bg-bg-3"
            onClick={onClose}
            aria-label="Close viewer"
          >
            <Icon name="close" size={18} />
          </button>
          <div>
            <div className="text-sm font-bold">{missionName}</div>
            <div className="text-sm text-t-mid">
              Capture <b className="text-t-hi">{current.seq}</b> of {captures.length}
            </div>
          </div>
        </div>
        <div className="text-xs tabular-nums text-t-mid">{current.image_id}</div>
      </div>

      <div className="relative grid min-h-0 flex-1 place-items-center px-20">
        <button className={`${VNAV} left-4`} onClick={() => go(-1)} disabled={idx === 0} aria-label="Previous">
          <Icon name="chevL" size={22} />
        </button>

        <div className="relative max-h-full max-w-full overflow-hidden rounded-xl shadow-[0_18px_50px_#00000099]">
          <img
            key={current.image_id}
            className="block max-h-[78vh] max-w-full animate-[fadeIn_0.28s_ease-out]"
            src={imageUrl(current.image_id)}
            alt={`capture ${current.seq}`}
            draggable={false}
          />
          <div className="absolute bottom-3.5 left-3.5 flex flex-wrap gap-2">
            <Vchip>
              <Icon name="camera" size={12} className="text-acc" />
              HDG <span className="text-acc">{current.heading}° {compass(current.heading)}</span>
            </Vchip>
            <Vchip>ALT {current.alt} m</Vchip>
            <Vchip>WP {current.waypoint_index}</Vchip>
            <Vchip>
              {current.lat.toFixed(5)}, {current.lon.toFixed(5)}
            </Vchip>
          </div>
        </div>

        <button
          className={`${VNAV} right-4`}
          onClick={() => go(1)}
          disabled={idx === captures.length - 1}
          aria-label="Next"
        >
          <Icon name="chevR" size={22} />
        </button>
      </div>

      <div
        className="scroll flex flex-none items-center gap-1.5 overflow-x-auto px-5 pb-4 pt-3"
        ref={filmRef}
      >
        {captures.map((c, i) => (
          <div
            key={c.image_id}
            data-i={i}
            onClick={() => onSelectSeq(c.seq)}
            className={`relative h-10 w-14 flex-none cursor-pointer overflow-hidden rounded border-[1.5px] transition hover:opacity-[0.85] ${
              i === idx ? 'border-acc opacity-100' : 'border-transparent opacity-50'
            }`}
          >
            {Math.abs(i - idx) < 22 ? (
              <img
                src={imageUrl(c.image_id)}
                alt=""
                draggable={false}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="skel h-full w-full" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Vchip({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 rounded-md border border-line-2 bg-[#080a0b]/70 px-2 py-1 text-2xs text-t-hi backdrop-blur-[6px]">
      {children}
    </span>
  );
}
