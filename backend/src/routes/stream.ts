import { Router } from 'express';
import { MISSIONS, getMissionById, type Mission } from '../data/missions.js';
import { simulateMission } from '../simulator.js';

export const streamRouter = Router();

// In-memory registry of active "live" mission runs.
// Keyed by a fresh run_id that the client receives on POST /start and uses
// to open the SSE stream. We don't persist these — restart the server and
// any in-flight run is gone.
interface ActiveRun {
  run_id: string;
  mission: Mission;
  /** Created ts, used to expire stale runs. */
  created_at: number;
}
const activeRuns = new Map<string, ActiveRun>();
const RUN_TTL_MS = 10 * 60 * 1000; // 10 minutes
const SSE_HEARTBEAT_MS = 15_000;

setInterval(() => {
  const cutoff = Date.now() - RUN_TTL_MS;
  for (const [id, run] of activeRuns.entries()) {
    if (run.created_at < cutoff) activeRuns.delete(id);
  }
}, 60_000).unref();

// POST /api/missions/start
// Body: { mission_template_id?: string }. If omitted, picks a random
// completed mission. Returns: { run_id, mission, stream_url }.
streamRouter.post('/missions/start', (req, res) => {
  const templateId = (req.body as { mission_template_id?: string } | undefined)
    ?.mission_template_id;

  let template: Mission | undefined;
  if (templateId) {
    template = getMissionById(templateId);
    if (!template) {
      res.status(404).json({ error: `Mission template ${templateId} not found` });
      return;
    }
  } else {
    const completes = MISSIONS.filter((m) => m.status === 'complete');
    template = completes[Math.floor(Math.random() * completes.length)];
  }
  if (!template) {
    res.status(503).json({ error: 'No mission templates available to replay' });
    return;
  }

  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const liveMission: Mission = {
    ...template,
    id: runId,
    name: `LIVE: ${template.name}`,
    started_at: new Date().toISOString(),
    ended_at: '', // filled in by the simulator's terminal event
  };
  activeRuns.set(runId, {
    run_id: runId,
    mission: liveMission,
    created_at: Date.now(),
  });

  res.json({
    run_id: runId,
    mission: liveMission,
    stream_url: `/api/missions/${runId}/stream`,
  });
});

// GET /api/missions/:run_id/stream
// Server-Sent Events stream of telemetry + image-captured events.
// Closes after the terminal mission_complete / mission_aborted event.
streamRouter.get('/missions/:run_id/stream', async (req, res) => {
  const run = activeRuns.get(req.params.run_id!);
  if (!run) {
    res.status(404).json({ error: 'Run not found or expired' });
    return;
  }

  // SSE headers.
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering (nginx)
  res.flushHeaders();

  // Heartbeat — comment lines keep idle proxies / load balancers from
  // closing the connection. Costs ~3 bytes every 15s.
  const heartbeat = setInterval(() => {
    res.write(`: keepalive ${Date.now()}\n\n`);
  }, SSE_HEARTBEAT_MS);

  // Speed multiplier — 3× by default so a 25-min mission demos in ~8 min.
  // Override with ?speed=1.0 for true real-time, or higher for fast demos.
  const speed = Math.max(0.5, Math.min(20, Number(req.query.speed) || 3));
  const { frames, stop } = simulateMission(run.mission, { speed });

  let frameId = 0;

  const cleanup = () => {
    clearInterval(heartbeat);
    stop();
    activeRuns.delete(run.run_id);
  };
  req.on('close', cleanup);

  try {
    for await (const frame of frames) {
      // SSE format: `id: N\nevent: <type>\ndata: <json>\n\n`. The `id:`
      // line is what EventSource uses for Last-Event-ID on reconnect.
      frameId += 1;
      res.write(`id: ${frameId}\n`);
      res.write(`event: ${frame.type}\n`);
      res.write(`data: ${JSON.stringify(frame)}\n\n`);
    }
  } catch (err) {
    console.error(`[stream] error in run ${run.run_id}:`, err);
  } finally {
    cleanup();
    res.end();
  }
});
