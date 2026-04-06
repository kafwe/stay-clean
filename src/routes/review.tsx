import { createFileRoute } from '@tanstack/react-router'
import { ReviewPage } from '#/features/review/ReviewPage'
import { loadDashboard, weekSearchSchema } from '#/lib/dashboard-page'

export const Route = createFileRoute('/review')({
  validateSearch: weekSearchSchema,
  loaderDeps: ({ search }) => ({ weekStart: search.week }),
  loader: ({ deps }) => loadDashboard({ data: { weekStart: deps.weekStart } }),
  component: ReviewPage,
})
