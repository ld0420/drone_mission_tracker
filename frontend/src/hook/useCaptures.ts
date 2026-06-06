import { useInfiniteQuery } from '@tanstack/react-query';
import { listCaptures } from '@/api/client';
import type { Paginated, Capture } from '@/types/mission';

/**
 * Offset-paginated captures for the sidebar. Offset (not cursor) because the
 * sidebar shows captures in stable seq order and may want to jump pages; the
 * dense missions top out at ~190, so a 100-per-page window is plenty.
 */
export function useCaptures(missionId: string, pageSize = 100) {
  return useInfiniteQuery({
    queryKey: ['mission', missionId, 'captures', { pageSize }],
    queryFn: ({ pageParam }) =>
      listCaptures(missionId, { offset: pageParam, limit: pageSize }),
    initialPageParam: 0,
    getNextPageParam: (last: Paginated<Capture>) => {
      const next = last.offset + last.limit;
      return next < last.total ? next : undefined;
    },
    enabled: !!missionId,
  });
}
