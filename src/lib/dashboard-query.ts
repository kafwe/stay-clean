import type { QueryClient } from '@tanstack/react-query'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { loadDashboard } from '#/lib/dashboard-page'

export function dashboardQueryKey(weekStart?: string) {
  return ['dashboard', weekStart ?? 'current-week'] as const
}

export function dashboardQueryOptions(weekStart?: string) {
  return queryOptions({
    queryKey: dashboardQueryKey(weekStart),
    queryFn: () => loadDashboard({ data: { weekStart } }),
  })
}

export async function invalidateDashboardQuery(queryClient: QueryClient, weekStart?: string) {
  await queryClient.invalidateQueries({
    queryKey: dashboardQueryKey(weekStart),
    exact: true,
  })
}

export function useDashboardActionMutation(weekStart?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (action: () => Promise<void>) => {
      await action()
    },
    onSuccess: async () => {
      await invalidateDashboardQuery(queryClient, weekStart)
    },
  })
}
