import { createFileRoute } from '@tanstack/react-router'
import { SetupPage } from '#/features/setup/SetupPage'

export const Route = createFileRoute('/_planner/setup')({
  component: SetupPage,
})