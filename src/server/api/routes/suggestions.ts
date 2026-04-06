import {
  approveSuggestedChange,
  rejectSuggestedChange,
} from '#/lib/dashboard'
import type { ApiApp } from '../types'

export function registerSuggestionRoutes(app: ApiApp) {
  app.post('/api/suggestions/:id/approve', async (c) => {
    await approveSuggestedChange(c.req.param('id'))
    return c.json({ ok: true })
  })

  app.post('/api/suggestions/:id/reject', async (c) => {
    await rejectSuggestedChange(c.req.param('id'))
    return c.json({ ok: true })
  })
}