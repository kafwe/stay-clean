import { getDashboardSnapshot } from '#/lib/dashboard'
import type { ApiApp } from '../types'

export function registerDashboardRoutes(app: ApiApp) {
  app.get('/api/dashboard', async (c) => {
    return c.json(await getDashboardSnapshot(c.req.query('weekStart') || undefined))
  })
}