import { Outlet, createFileRoute } from '@tanstack/react-router'
import { loadDashboard, weekSearchSchema } from '#/lib/dashboard-page'

export const Route = createFileRoute('/_planner')({
  validateSearch: weekSearchSchema,
  loaderDeps: ({ search }) => ({ weekStart: search.week }),
  loader: ({ deps }) => loadDashboard({ data: { weekStart: deps.weekStart } }),
  component: PlannerLayout,
})

function PlannerLayout() {
  return <Outlet />
}