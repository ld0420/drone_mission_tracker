import { useEffect, useRef, useState } from 'react';
import type {
  ImageCapturedEvent,
  MissionAbortedEvent,
  MissionCompleteEvent,
  TelemetryEvent,
} from '@/types/mission';

export type LiveStatus = 'connecting' | 'streaming' | 'complete' | 'aborted' | 'error';

export interface MissionStreamState {
  status: LiveStatus;
  /** Latest telemetry, flushed at render cadence (~12 Hz), not the 5 Hz×speed
   *  incoming rate — decouples re-renders from the stream. */
  frame: TelemetryEvent | null;
  /** Actual flown breadcrumb as [lon, lat] points (grows at flush cadence). */
  trail: Array<[number, number]>;
  captures: ImageCapturedEvent[];
  latestCapture: ImageCapturedEvent | null;
  abortReason?: string;
  finalElapsed?: number;
}

const FLUSH_MS = 80; // ~12 Hz render cadence

/**
 * Subscribes to the live mission SSE stream. Telemetry arrives fast (5 Hz at
 * speed 1, faster when sped up); we stash the latest in a ref and flush to
 * React state on a fixed ~12 Hz interval, so the HUD + map re-render at a calm,
 * constant cadence regardless of stream speed. Captures + terminal events are
 * infrequent, so they update state directly.
 */
export function useMissionStream(runId: string | null, speed = 3): MissionStreamState {
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const [frame, setFrame] = useState<TelemetryEvent | null>(null);
  const [trail, setTrail] = useState<Array<[number, number]>>([]);
  const [captures, setCaptures] = useState<ImageCapturedEvent[]>([]);
  const [latestCapture, setLatestCapture] = useState<ImageCapturedEvent | null>(null);
  const [abortReason, setAbortReason] = useState<string>();
  const [finalElapsed, setFinalElapsed] = useState<number>();

  const latestRef = useRef<TelemetryEvent | null>(null);
  const trailRef = useRef<Array<[number, number]>>([]);
  const pendingRef = useRef(false);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!runId) return;
    // reset for a fresh run
    setStatus('connecting');
    setFrame(null);
    setTrail([]);
    setCaptures([]);
    setLatestCapture(null);
    setAbortReason(undefined);
    setFinalElapsed(undefined);
    latestRef.current = null;
    trailRef.current = [];
    pendingRef.current = false;
    doneRef.current = false;

    const es = new EventSource(`/api/missions/${runId}/stream?speed=${speed}`);

    es.onopen = () => setStatus((s) => (s === 'connecting' ? 'streaming' : s));

    es.addEventListener('telemetry', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as TelemetryEvent;
      latestRef.current = d;
      pendingRef.current = true;
    });

    es.addEventListener('image_captured', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as ImageCapturedEvent;
      setCaptures((prev) => [...prev, d]);
      setLatestCapture(d);
    });

    es.addEventListener('mission_complete', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as MissionCompleteEvent;
      doneRef.current = true;
      setFinalElapsed(d.elapsed_s);
      setStatus('complete');
      es.close();
    });

    es.addEventListener('mission_aborted', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as MissionAbortedEvent;
      doneRef.current = true;
      setFinalElapsed(d.elapsed_s);
      setAbortReason(d.reason);
      setStatus('aborted');
      es.close();
    });

    es.onerror = () => {
      // Terminal events close the stream intentionally — ignore that error.
      if (!doneRef.current) setStatus('error');
    };

    // Flush the latest telemetry → state at a steady cadence.
    const flush = setInterval(() => {
      if (!pendingRef.current || !latestRef.current) return;
      pendingRef.current = false;
      const d = latestRef.current;
      trailRef.current.push([d.lon, d.lat]);
      setFrame(d);
      setTrail([...trailRef.current]);
    }, FLUSH_MS);

    return () => {
      clearInterval(flush);
      es.close();
    };
  }, [runId, speed]);

  return { status, frame, trail, captures, latestCapture, abortReason, finalElapsed };
}
