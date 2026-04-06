import { createFileRoute } from '@tanstack/react-router'
import { ReviewPage } from '#/features/review/ReviewPage'

export const Route = createFileRoute('/_planner/review')({
  component: ReviewPage,
})