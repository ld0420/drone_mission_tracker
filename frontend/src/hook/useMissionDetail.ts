import { useQuery } from '@tanstack/react-query';
import { getMission, getMissionPath } from '@/api/client';

/** Mission metadata + flight-path waypoints (GET /api/missions/:id). */
export function useMissionDetail(missionId: string) {
  return useQuery({
    queryKey: ['mission', missionId],
    queryFn: () => getMission(missionId),
    enabled: !!missionId,
  });
}

/** Map-ready GeoJSON geometry (GET /api/missions/:id/path). */
export function useMissionPath(missionId: string) {
  return useQuery({
    queryKey: ['mission', missionId, 'path'],
    queryFn: () => getMissionPath(missionId),
    enabled: !!missionId,
  });
}
