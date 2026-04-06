import { Outlet, createFileRoute, retainSearchParams } from '@tanstack/react-router'
import { loadDashboard, weekSearchSchema } from '#/lib/dashboard-page'

export const Route = createFileRoute('/_planner')({
  validateSearch: weekSearchSchema,
  search: {
    middlewares: [retainSearchParams(['week'])],
  },
  loaderDeps: ({ search }) => ({ weekStart: search.week }),
  loader: ({ deps }) => loadDashboard({ data: { weekStart: deps.weekStart } }),
  component: PlannerLayout,
})

function PlannerLayout() {
  return <Outlet />
}