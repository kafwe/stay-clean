import { zValidator } from '@hono/zod-validator'
import { regenerateWeekFromICal } from '#/lib/dashboard'
import { weekSchema } from '#/lib/validation'
import type { ApiApp } from '../types'

export function registerSystemRoutes(app: ApiApp) {
  app.post('/api/system/run-sync', zValidator('json', weekSchema), async (c) => {
    await regenerateWeekFromICal('manual', c.req.valid('json').weekStart)
    return c.json({ ok: true })
  })
}