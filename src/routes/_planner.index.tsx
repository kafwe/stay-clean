import { createFileRoute } from '@tanstack/react-router'
import { WeekPage } from '#/features/week/WeekPage'

export const Route = createFileRoute('/_planner/')({
  component: WeekPage,
})