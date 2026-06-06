// Thin typed fetch wrapper for the mission-tracker backend. All requests go
// through the Vite proxy (/api → http://localhost:4571).
//
// SCAFFOLD: signatures + return types are settled; bodies are minimal so the
// feature components can be wired against a stable surface. Caching,
// retry/abort, and an image-URL helper land during implementation.

import type {
  Capture,
  CursorPage,
  MissionDetail,
  MissionPath,
  MissionSummary,
  Paginated,
  StartMissionResponse,
} from '@/types/mission';

const BASE = '/api';

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json() as Promise<T>;
}

export function listMissions(
  params: { cursor?: string | null; limit?: number } = {},
): Promise<CursorPage<MissionSummary>> {
  const q = new URLSearchParams({ limit: String(params.limit ?? 20) });
  if (params.cursor) q.set('cursor', params.cursor);
  return getJSON(`/missions?${q}`);
}

export function getMission(id: string): Promise<MissionDetail> {
  return getJSON(`/missions/${id}`);
}

/** Map-ready GeoJSON: flight path + classified waypoints + directional captures. */
export function getMissionPath(id: string): Promise<MissionPath> {
  return getJSON(`/missions/${id}/path`);
}

export function listCaptures(
  missionId: string,
  params: { limit?: number; offset?: number } = {},
): Promise<Paginated<Capture>> {
  const q = new URLSearchParams({
    limit: String(params.limit ?? 100),
    offset: String(params.offset ?? 0),
  });
  return getJSON(`/missions/${missionId}/captures?${q}`);
}

export function startMission(
  templateId?: string,
): Promise<StartMissionResponse> {
  return fetch(`${BASE}/missions/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(templateId ? { mission_template_id: templateId } : {}),
  }).then((r) => r.json());
}

/** Deterministic image endpoint — safe to cache freely. */
export function imageUrl(imageId: string): string {
  return `${BASE}/images/${imageId}`;
}
