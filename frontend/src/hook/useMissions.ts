import { useInfiniteQuery } from '@tanstack/react-query';
import { listMissions } from '@/api/client';
import type { CursorPage, MissionSummary } from '@/types/mission';

/**
 * Cursor-paginated mission list. Maps the backend's keyset cursor onto
 * TanStack Query's infinite-query model: each `pageParam` is a `next_cursor`
 * (null for the first page), and `getNextPageParam` stops once the server
 * reports `has_more: false`.
 */
export function useMissions(limit = 20) {
  return useInfiniteQuery({
    queryKey: ['missions', { limit }],
    queryFn: ({ pageParam }) => listMissions({ cursor: pageParam, limit }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: CursorPage<MissionSummary>) =>
      last.has_more ? last.next_cursor : undefined,
  });
}
