import { createFileRoute } from '@tanstack/react-router'
import { SetupPage } from '#/features/setup/SetupPage'
import { loadDashboard, weekSearchSchema } from '#/lib/dashboard-page'

export const Route = createFileRoute('/setup')({
  validateSearch: weekSearchSchema,
  loaderDeps: ({ search }) => ({ weekStart: search.week }),
  loader: ({ deps }) => loadDashboard({ data: { weekStart: deps.weekStart } }),
  component: SetupPage,
})
