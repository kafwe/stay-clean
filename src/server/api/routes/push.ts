import { zValidator } from '@hono/zod-validator'
import { savePushSubscription } from '#/lib/db'
import { subscriptionSchema } from '#/lib/validation'
import type { ApiApp } from '../types'

export function registerPushRoutes(app: ApiApp) {
  app.post('/api/push/subscribe', zValidator('json', subscriptionSchema), async (c) => {
    const payload = c.req.valid('json')
    await savePushSubscription({
      endpoint: payload.endpoint,
      p256dh: payload.keys.p256dh,
      auth: payload.keys.auth,
    })
    return c.json({ ok: true })
  })
}