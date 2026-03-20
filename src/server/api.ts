import { env } from 'cloudflare:workers'
import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  addApartment,
  addCleaner,
  addManualRequest,
  addManualRequestToWeek,
  applyQuickScheduleEdit,
  approveSuggestedChange,
  confirmCurrentWeek,
  createChatSuggestion,
  getDashboardSnapshot,
  regenerateWeekFromICal,
  rejectSuggestedChange,
  saveApartmentCoordinates,
  seedDistanceMatrix,
} from '#/lib/dashboard'
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from '#/lib/auth'
import { savePushSubscription } from '#/lib/db'

const app = new Hono<{ Bindings: Cloudflare.Env }>()

const apartmentSchema = z.object({
  name: z.string().min(2),
  buildingId: z.string().min(1),
  address: z.string().min(4),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  icalUrl: z.string().url().optional().or(z.literal('')).optional(),
})

const weekSchema = z.object({
  weekStart: z.string().optional(),
})

const cleanerSchema = z.object({
  name: z.string().min(2),
  colorHex: z.string().optional(),
})

const manualSchema = z.object({
  label: z.string().min(2),
  apartmentId: z.string().optional(),
  taskDate: z.string().optional(),
  weekday: z.number().min(0).max(6).nullable().optional(),
  isRecurring: z.boolean().default(false),
  notes: z.string().optional(),
  weekStart: z.string().optional(),
})

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
})

const quickEditSchema = z.object({
  weekStart: z.string().optional(),
  assignmentId: z.string().min(1),
  cleanerId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  taskDate: z.string().optional(),
})

app.post(
  '/api/auth/login',
  zValidator(
    'json',
    z.object({
      password: z.string().min(1),
    }),
  ),
  async (c) => {
    const { password } = c.req.valid('json')

    if (password !== env.ADMIN_PASSWORD) {
      return c.json({ error: 'Incorrect password' }, 401)
    }

    const token = await createSessionToken(env.SESSION_SECRET)
    setCookie(c, SESSION_COOKIE_NAME, token, sessionCookieOptions())

    return c.json({ ok: true })
  },
)

app.post('/api/auth/logout', async (c) => {
  deleteCookie(c, SESSION_COOKIE_NAME, sessionCookieOptions())
  return c.json({ ok: true })
})

app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/auth/login' || c.req.path === '/api/auth/logout') {
    await next()
    return
  }

  const token = getCookie(c, SESSION_COOKIE_NAME)
  if (!(await verifySessionToken(token, env.SESSION_SECRET))) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
})

app.get('/api/dashboard', async (c) => {
  return c.json(await getDashboardSnapshot(c.req.query('weekStart') || undefined))
})

app.post('/api/setup/apartments', zValidator('json', apartmentSchema), async (c) => {
  const payload = c.req.valid('json')
  await addApartment({
    ...payload,
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    icalUrl: payload.icalUrl || null,
  })
  return c.json({ ok: true })
})

app.post(
  '/api/setup/apartments/:id/location',
  zValidator(
    'json',
    z.object({
      latitude: z.number(),
      longitude: z.number(),
    }),
  ),
  async (c) => {
    const payload = c.req.valid('json')
    await saveApartmentCoordinates({
      apartmentId: c.req.param('id'),
      latitude: payload.latitude,
      longitude: payload.longitude,
    })
    return c.json({ ok: true })
  },
)

app.post('/api/setup/cleaners', zValidator('json', cleanerSchema), async (c) => {
  await addCleaner(c.req.valid('json'))
  return c.json({ ok: true })
})

app.post('/api/setup/manual-cleans', zValidator('json', manualSchema), async (c) => {
  const payload = c.req.valid('json')

  if (payload.weekStart && payload.taskDate && !payload.isRecurring) {
    await addManualRequestToWeek({
      weekStart: payload.weekStart,
      label: payload.label,
      apartmentId: payload.apartmentId || null,
      taskDate: payload.taskDate,
      notes: payload.notes || null,
    })
  } else {
    await addManualRequest({
      ...payload,
      apartmentId: payload.apartmentId || null,
      taskDate: payload.taskDate || null,
      notes: payload.notes || null,
    })
  }

  return c.json({ ok: true })
})

app.post('/api/push/subscribe', zValidator('json', subscriptionSchema), async (c) => {
  const payload = c.req.valid('json')
  await savePushSubscription({
    endpoint: payload.endpoint,
    p256dh: payload.keys.p256dh,
    auth: payload.keys.auth,
  })
  return c.json({ ok: true })
})

app.post(
  '/api/chat/propose',
  zValidator(
    'json',
    z.object({
      message: z.string().min(4),
      weekStart: z.string().optional(),
    }),
  ),
  async (c) => {
    const payload = c.req.valid('json')
    await createChatSuggestion(payload.message, payload.weekStart)
    return c.json({ ok: true })
  },
)

app.post('/api/schedule/confirm', zValidator('json', weekSchema), async (c) => {
  await confirmCurrentWeek(c.req.valid('json').weekStart)
  return c.json({ ok: true })
})

app.post('/api/schedule/manual-edit', zValidator('json', quickEditSchema), async (c) => {
  const payload = c.req.valid('json')
  await applyQuickScheduleEdit(payload)
  return c.json({ ok: true })
})

app.post('/api/suggestions/:id/approve', async (c) => {
  await approveSuggestedChange(c.req.param('id'))
  return c.json({ ok: true })
})

app.post('/api/suggestions/:id/reject', async (c) => {
  await rejectSuggestedChange(c.req.param('id'))
  return c.json({ ok: true })
})

app.post('/api/setup/distance-matrix/seed', async (c) => {
  await seedDistanceMatrix()
  return c.json({ ok: true })
})

app.post('/api/system/run-sync', zValidator('json', weekSchema), async (c) => {
  await regenerateWeekFromICal('manual', c.req.valid('json').weekStart)
  return c.json({ ok: true })
})

export { app }
