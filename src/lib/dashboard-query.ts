import type { QueryClient } from '@tanstack/react-query'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { loadDashboard } from '#/lib/dashboard-page'
import type { DashboardData } from '#/lib/types'

type DashboardAction = () => Promise<void>

type DashboardMutationInput =
  | DashboardAction
  | {
      action: DashboardAction
      optimisticUpdate?: (current: DashboardData) => DashboardData
    }

interface DashboardMutationContext {
  previousDashboard?: DashboardData
}

function resolveMutationInput(input: DashboardMutationInput) {
  if (typeof input === 'function') {
    return {
      action: input,
      optimisticUpdate: undefined,
    }
  }

  return input
}

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
  const queryKey = dashboardQueryKey(weekStart)

  return useMutation({
    mutationFn: async (input: DashboardMutationInput) => {
      const { action } = resolveMutationInput(input)
      await action()
    },
    onMutate: async (input): Promise<DashboardMutationContext> => {
      const { optimisticUpdate } = resolveMutationInput(input)
      if (!optimisticUpdate) {
        return {}
      }

      await queryClient.cancelQueries({
        queryKey,
        exact: true,
      })

      const previousDashboard = queryClient.getQueryData<DashboardData>(queryKey)
      if (!previousDashboard) {
        return {}
      }

      queryClient.setQueryData<DashboardData>(queryKey, (current) => {
        if (!current) {
          return current
        }

        return optimisticUpdate(current)
      })

      return {
        previousDashboard,
      }
    },
    onError: (_error, _input, context) => {
      if (!context?.previousDashboard) {
        return
      }

      queryClient.setQueryData(queryKey, context.previousDashboard)
    },
    onSuccess: async () => {
      await invalidateDashboardQuery(queryClient, weekStart)
    },
  })
}
