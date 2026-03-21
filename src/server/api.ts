import { env } from 'cloudflare:workers'
import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  addApartment,
  addCleaner,
  deleteCleaner,
  addManualRequest,
  addManualRequestToWeek,
  deleteApartment,
  deleteScheduleAssignment,
  applyQuickScheduleEdit,
  approveSuggestedChange,
  confirmCurrentWeek,
  getDashboardSnapshot,
  regenerateWeekFromICal,
  rejectSuggestedChange,
  saveApartmentCoordinates,
  seedDistanceMatrix,
  updateCleanerName,
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
  address: z.string().min(4),
  icalUrl: z.string().url().optional().or(z.literal('')).optional(),
})

const weekSchema = z.object({
  weekStart: z.string().optional(),
})

const cleanerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .or(z.literal(''))
    .optional(),
})

const cleanerUpdateSchema = z.object({
  name: z.string().trim().min(2).max(60),
})

const manualSchema = z.object({
  label: z.string().min(2).optional(),
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

async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number }> {
  const query = new URLSearchParams({
    q: address,
    format: 'jsonv2',
    limit: '1',
  })

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${query.toString()}`, {
    headers: {
      accept: 'application/json',
      'accept-language': 'en',
      'user-agent': 'stay-clean/1.0',
    },
  })

  if (!response.ok) {
    throw new Error('Could not find coordinates for this address right now')
  }

  const payload = (await response.json().catch(() => null)) as
    | Array<{ lat?: string; lon?: string }>
    | null

  const firstHit = payload?.[0]
  const latitude = Number(firstHit?.lat)
  const longitude = Number(firstHit?.lon)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Could not geocode this address. Please try a more specific address.')
  }

  return { latitude, longitude }
}

function inferBuildingId(address: string) {
  const primarySegment = address
    .split(',')
    .map((part) => part.trim())
    .find(Boolean)

  return (primarySegment || address).slice(0, 80)
}

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
  const coordinates = await geocodeAddress(payload.address)

  await addApartment({
    name: payload.name,
    buildingId: inferBuildingId(payload.address),
    address: payload.address,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    icalUrl: payload.icalUrl || null,
  })
  return c.json({ ok: true })
})

app.post('/api/setup/apartments/:id/delete', async (c) => {
  await deleteApartment(c.req.param('id'))
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

app.post('/api/setup/cleaners/:id/update', zValidator('json', cleanerUpdateSchema), async (c) => {
  const payload = c.req.valid('json')
  await updateCleanerName({
    cleanerId: c.req.param('id'),
    name: payload.name,
  })
  return c.json({ ok: true })
})

app.post('/api/setup/cleaners/:id/delete', async (c) => {
  await deleteCleaner(c.req.param('id'))
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
  zValidator(
    'json',
    z.object({
      weekStart: z.string().optional(),
      assignmentId: z.string().min(1),
    }),
  ),
  async (c) => {
    await deleteScheduleAssignment(c.req.valid('json'))
    return c.json({ ok: true })
  },
)

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
