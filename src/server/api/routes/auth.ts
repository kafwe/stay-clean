import { env } from 'cloudflare:workers'
import { zValidator } from '@hono/zod-validator'
import { deleteCookie, setCookie } from 'hono/cookie'
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '#/lib/auth'
import { loginSchema } from '#/lib/validation'
import type { ApiApp } from '../types'

export function registerAuthRoutes(app: ApiApp) {
  app.post('/api/auth/login', zValidator('json', loginSchema), async (c) => {
    const { password } = c.req.valid('json')

    if (password !== env.ADMIN_PASSWORD) {
      return c.json({ error: 'That password is not correct' }, 401)
    }

    const token = await createSessionToken(env.SESSION_SECRET)
    setCookie(c, SESSION_COOKIE_NAME, token, sessionCookieOptions())

    return c.json({ ok: true })
  })

  app.post('/api/auth/logout', async (c) => {
    deleteCookie(c, SESSION_COOKIE_NAME, sessionCookieOptions())
    return c.json({ ok: true })
  })
}