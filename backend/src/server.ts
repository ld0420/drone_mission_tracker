import cors from 'cors';
import express, { type ErrorRequestHandler, type Request, type Response, type NextFunction } from 'express';
import { mediaRouter } from './routes/media.js';
import { missionsRouter } from './routes/missions.js';
import { streamRouter } from './routes/stream.js';

const PORT = Number(process.env.PORT) || 4571;

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json());

// One-line access log — handy for `tail -f` while debugging from the frontend.
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    // Skip the SSE stream — it never finishes cleanly and would spam.
    if (req.path.endsWith('/stream')) return;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', missionsRouter);
app.use('/api', streamRouter);
app.use('/api', mediaRouter);

// 404 catch-all (must come after all routes).
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

// Final error handler — anything thrown in a route lands here.
const onError: ErrorRequestHandler = (err, req, res, _next) => {
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return;
  res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
};
app.use(onError);

const server = app.listen(PORT, () => {
  console.log(`[mission-tracker] backend listening on http://localhost:${PORT}`);
  console.log(`[mission-tracker] try: curl http://localhost:${PORT}/api/missions`);
});

// Graceful shutdown — important for SSE streams that may be holding connections open.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    console.log(`[mission-tracker] ${sig} received, shutting down...`);
    server.close(() => process.exit(0));
    // Force-exit after 5s if connections are still hanging.
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
