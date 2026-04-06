import { env } from 'cloudflare:workers'
import { getCookie } from 'hono/cookie'
import { SESSION_COOKIE_NAME, verifySessionToken } from '#/lib/auth'
import type { ApiApp } from '../types'

const PUBLIC_API_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/places/autocomplete',
])

export function registerApiAuthMiddleware(app: ApiApp) {
  app.use('/api/*', async (c, next) => {
    if (PUBLIC_API_PATHS.has(c.req.path)) {
      await next()
      return
    }

    const token = getCookie(c, SESSION_COOKIE_NAME)
    if (!(await verifySessionToken(token, env.SESSION_SECRET))) {
      return c.json({ error: 'Please sign in again' }, 401)
    }

    await next()
  })
}