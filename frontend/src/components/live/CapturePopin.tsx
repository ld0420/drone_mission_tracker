import type { ImageCapturedEvent } from '@/types/mission';
import { imageUrl } from '@/api/client';
import { compass } from '@/utils/format';

interface CapturePopinProps {
  captures: ImageCapturedEvent[];
}

const seqOf = (id: string) => {
  const m = id.match(/(\d+)\s*$/);
  return m ? parseInt(m[1]!, 10) : 0;
};

/**
 * Pops up the newest capture as it arrives over the stream — a hero image plus
 * a short filmstrip of the last few — so the operator never scrolls to find the
 * latest. The hero re-mounts on each new capture (keyed by image_id) to replay
 * the fade-in.
 */
export function CapturePopin({ captures }: CapturePopinProps) {
  const latest = captures.at(-1);
  if (!latest) return null;
  const strip = captures.slice(-4).reverse();

  return (
    <div className="w-[300px] overflow-hidden rounded-2xl border border-line bg-bg-1/90 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur">
      <div className="relative">
        <img
          key={latest.image_id}
          src={imageUrl(latest.image_id)}
          alt={`capture ${seqOf(latest.image_id)}`}
          className="h-[168px] w-full animate-[fadeIn_220ms_ease-out] object-cover"
        />
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-2xs font-semibold backdrop-blur-sm">
          #{seqOf(latest.image_id)}
        </span>
      </div>

      <div className="p-3">
        <div className="text-2xs font-medium uppercase tracking-widest text-acc">New capture</div>
        <div className="mt-1 text-xs tabular-nums text-t-mid">
          HDG {Math.round(latest.heading)}° {compass(latest.heading)} · ALT{' '}
          {Math.round(latest.alt)} m · WP {latest.waypoint_index}
        </div>

        <div className="mt-2.5 flex gap-1.5">
          {strip.map((c, i) => (
            <img
              key={c.image_id}
              src={imageUrl(c.image_id)}
              alt=""
              className={`h-9 w-12 rounded-md object-cover ring-1 ${
                i === 0 ? 'ring-2 ring-acc' : 'ring-line-2'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
