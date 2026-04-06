import { zValidator } from '@hono/zod-validator'
import {
  applyQuickScheduleEdit,
  confirmCurrentWeek,
  deleteScheduleAssignment,
} from '#/lib/dashboard'
import {
  deleteAssignmentSchema,
  quickEditSchema,
  weekSchema,
} from '#/lib/validation'
import type { ApiApp } from '../types'

export function registerScheduleRoutes(app: ApiApp) {
  app.post('/api/schedule/confirm', zValidator('json', weekSchema), async (c) => {
    await confirmCurrentWeek(c.req.valid('json').weekStart)
    return c.json({ ok: true })
  })

  app.post('/api/schedule/manual-edit', zValidator('json', quickEditSchema), async (c) => {
    const payload = c.req.valid('json')
    await applyQuickScheduleEdit(payload)
    return c.json({ ok: true })
  })

  app.post(
    '/api/schedule/delete-assignment',
    zValidator('json', deleteAssignmentSchema),
    async (c) => {
      await deleteScheduleAssignment(c.req.valid('json'))
      return c.json({ ok: true })
    },
  )
}