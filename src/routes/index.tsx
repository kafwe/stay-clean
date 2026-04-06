import { createFileRoute } from '@tanstack/react-router'
import { WeekPage } from '#/features/week/WeekPage'
import { loadDashboard, weekSearchSchema } from '#/lib/dashboard-page'

export const Route = createFileRoute('/')({
  validateSearch: weekSearchSchema,
  loaderDeps: ({ search }) => ({ weekStart: search.week }),
  loader: ({ deps }) => loadDashboard({ data: { weekStart: deps.weekStart } }),
  component: WeekPage,
})
