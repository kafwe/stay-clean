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
  bookingIcalUrl: z.string().url().optional().or(z.literal('')).optional(),
  airbnbIcalUrl: z.string().url().optional().or(z.literal('')).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
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

function normalizeStreetNumber(value: string | undefined | null) {
  return (value || '').trim().toLocaleLowerCase()
}

async function geocodeAddressWithNominatim(
  address: string,
): Promise<{ latitude: number; longitude: number }> {
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

async function geocodeAddressWithGoogle(
  address: string,
  googleApiKey: string,
): Promise<{ latitude: number; longitude: number }> {
  const query = new URLSearchParams({
    address,
    components: 'country:ZA',
    key: googleApiKey,
  })

  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${query.toString()}`)

  if (!response.ok) {
    throw new Error('Could not find coordinates for this address right now')
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        status?: string
        results?: Array<{
          geometry?: {
            location?: {
              lat?: number
              lng?: number
            }
          }
        }>
      }
    | null

  const firstHit = payload?.results?.[0]
  const latitude = Number(firstHit?.geometry?.location?.lat)
  const longitude = Number(firstHit?.geometry?.location?.lng)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Could not geocode this address. Please try a more specific address.')
  }

  return { latitude, longitude }
}

async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number }> {
  const googleApiKey = (env.GOOGLE_PLACES_API_KEY || '').trim()

  if (googleApiKey) {
    try {
      return await geocodeAddressWithGoogle(address, googleApiKey)
    } catch {
      return geocodeAddressWithNominatim(address)
    }
  }

  return geocodeAddressWithNominatim(address)
}

interface AddressSuggestion {
  label: string
  latitude: number
  longitude: number
}

interface NominatimAddress {
  house_number?: string
  road?: string
  suburb?: string
  neighbourhood?: string
  city?: string
  town?: string
  village?: string
  postcode?: string
}

interface NominatimSearchResult {
  display_name?: string
  lat?: string
  lon?: string
  address?: NominatimAddress
}

interface GoogleAddressComponent {
  long_name?: string
  short_name?: string
  types?: string[]
}

function getGoogleAddressPart(
  components: GoogleAddressComponent[] | undefined,
  type: string,
) {
  return components?.find((component) => component.types?.includes(type))?.long_name
}

function buildSimplifiedGoogleLabel(
  formattedAddress: string,
  components: GoogleAddressComponent[] | undefined,
) {
  const streetNumber = getGoogleAddressPart(components, 'street_number')
  const route = getGoogleAddressPart(components, 'route')
  const suburb =
    getGoogleAddressPart(components, 'sublocality_level_1') ||
    getGoogleAddressPart(components, 'sublocality') ||
    getGoogleAddressPart(components, 'neighborhood')
  const city =
    getGoogleAddressPart(components, 'locality') ||
    getGoogleAddressPart(components, 'postal_town') ||
    getGoogleAddressPart(components, 'administrative_area_level_2')
  const postcode = getGoogleAddressPart(components, 'postal_code')

  const street = [streetNumber, route].filter(Boolean).join(' ').trim()
  const parts = [street, suburb, city, postcode]
    .map((part) => (part || '').trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return formattedAddress
  }

  return Array.from(new Set(parts)).join(', ')
}

function buildSimplifiedSuggestionLabel(result: NominatimSearchResult) {
  const address = result.address
  const fallback = (result.display_name || '').trim()

  if (!address) {
    return fallback
  }

  const street = [address.house_number, address.road].filter(Boolean).join(' ').trim()
  const locality =
    address.suburb || address.neighbourhood || address.city || address.town || address.village
  const city = address.city || address.town || address.village

  const parts = [street, locality, city, address.postcode]
    .map((part) => (part || '').trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return fallback
  }

  return Array.from(new Set(parts)).join(', ')
}

function scoreSuggestionMatch(queryText: string, result: NominatimSearchResult) {
  const normalizedQuery = queryText.toLocaleLowerCase()
  const queryNumberMatch = normalizedQuery.match(/\b\d+[a-z]?\b/i)
  const queryStreetNumber = queryNumberMatch?.[0] ?? null
  const houseNumber = result.address?.house_number?.toLocaleLowerCase() ?? ''
  const hasHouseNumber = houseNumber.length > 0
  const hasRoad = Boolean(result.address?.road)
  const hasPostcode = Boolean(result.address?.postcode)
  const exactStreetNumberMatch =
    Boolean(queryStreetNumber) && houseNumber === queryStreetNumber?.toLocaleLowerCase()

  let score = 0

  if (exactStreetNumberMatch) {
    score += 7
  }

  if (hasHouseNumber) {
    score += 4
  }

  if (hasRoad) {
    score += 2
  }

  if (hasPostcode) {
    score += 1
  }

  return score
}

async function fetchAddressSuggestions(
  queryText: string,
  limit: number,
): Promise<AddressSuggestion[]> {
  const candidateLimit = Math.max(limit * 3, 12)
  const query = new URLSearchParams({
    q: queryText,
    format: 'jsonv2',
    limit: String(candidateLimit),
    addressdetails: '1',
    countrycodes: 'za',
  })

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${query.toString()}`, {
    headers: {
      accept: 'application/json',
      'accept-language': 'en',
      'user-agent': 'stay-clean/1.0',
    },
  })

  if (!response.ok) {
    throw new Error('Could not fetch place suggestions right now')
  }

  const payload = (await response.json().catch(() => null)) as Array<NominatimSearchResult> | null

  const scoredMatches = (payload ?? [])
    .map((item) => ({
      item,
      score: scoreSuggestionMatch(queryText, item),
    }))
    .sort((left, right) => right.score - left.score)

  return scoredMatches
    .map(({ item }) => item)
    .map((item) => {
      const latitude = Number(item.lat)
      const longitude = Number(item.lon)

      if (!item.display_name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null
      }

      return {
        label: buildSimplifiedSuggestionLabel(item),
        latitude,
        longitude,
      }
    })
    .filter((item): item is AddressSuggestion => Boolean(item))
    .slice(0, limit)
}

async function fetchAddressSuggestionsWithGoogle(
  queryText: string,
  limit: number,
  googleApiKey: string,
): Promise<AddressSuggestion[]> {
  const autocompleteQuery = new URLSearchParams({
    input: queryText,
    components: 'country:za',
    types: 'address',
    key: googleApiKey,
  })

  const autocompleteResponse = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${autocompleteQuery.toString()}`,
  )

  if (!autocompleteResponse.ok) {
    throw new Error('Could not fetch place suggestions right now')
  }

  const autocompletePayload = (await autocompleteResponse.json().catch(() => null)) as
    | {
        predictions?: Array<{
          place_id?: string
        }>
      }
    | null

  const placeIds = (autocompletePayload?.predictions ?? [])
    .map((prediction) => prediction.place_id)
    .filter((placeId): placeId is string => Boolean(placeId))
    .slice(0, Math.max(limit * 2, 8))

  if (placeIds.length === 0) {
    return []
  }

  const detailResults = await Promise.all(
    placeIds.map(async (placeId) => {
      const detailQuery = new URLSearchParams({
        place_id: placeId,
        fields: 'formatted_address,geometry/location,address_component',
        key: googleApiKey,
      })

      const detailResponse = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?${detailQuery.toString()}`,
      )

      if (!detailResponse.ok) {
        return null
      }

      const detailPayload = (await detailResponse.json().catch(() => null)) as
        | {
            result?: {
              formatted_address?: string
              geometry?: {
                location?: {
                  lat?: number
                  lng?: number
                }
              }
              address_components?: GoogleAddressComponent[]
            }
          }
        | null

      const formattedAddress = (detailPayload?.result?.formatted_address || '').trim()
      const latitude = Number(detailPayload?.result?.geometry?.location?.lat)
      const longitude = Number(detailPayload?.result?.geometry?.location?.lng)

      if (!formattedAddress || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null
      }

      const streetNumber = normalizeStreetNumber(
        getGoogleAddressPart(detailPayload?.result?.address_components, 'street_number'),
      )
      const queryStreetNumber = normalizeStreetNumber(
        queryText.match(/\b\d+[a-z]?\b/i)?.[0] ?? null,
      )
      const exactStreetNumberMatch =
        queryStreetNumber.length > 0 && streetNumber === queryStreetNumber

      return {
        label: buildSimplifiedGoogleLabel(
          formattedAddress,
          detailPayload?.result?.address_components,
        ),
        latitude,
        longitude,
        score: exactStreetNumberMatch ? 10 : streetNumber.length > 0 ? 6 : 0,
      }
    }),
  )

  const dedupeKeys = new Set<string>()
  return detailResults
    .filter(
      (
        result,
      ): result is { label: string; latitude: number; longitude: number; score: number } =>
        Boolean(result),
    )
    .sort((left, right) => right.score - left.score)
    .filter((result) => {
      const dedupeKey = `${result.label.toLocaleLowerCase()}|${result.latitude}|${result.longitude}`

      if (dedupeKeys.has(dedupeKey)) {
        return false
      }

      dedupeKeys.add(dedupeKey)
      return true
    })
    .slice(0, limit)
    .map((result) => ({
      label: result.label,
      latitude: result.latitude,
      longitude: result.longitude,
    }))
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
  if (
    c.req.path === '/api/auth/login' ||
    c.req.path === '/api/auth/logout' ||
    c.req.path === '/api/places/autocomplete'
  ) {
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

app.get('/api/places/autocomplete', async (c) => {
  const queryText = (c.req.query('q') || '').trim()

  if (queryText.length < 3) {
    return c.json({ suggestions: [] })
  }

  const googleApiKey = (env.GOOGLE_PLACES_API_KEY || '').trim()
  let suggestions: AddressSuggestion[] = []

  if (googleApiKey) {
    try {
      suggestions = await fetchAddressSuggestionsWithGoogle(queryText, 5, googleApiKey)
    } catch {
      suggestions = []
    }
  }

  if (suggestions.length === 0) {
    suggestions = await fetchAddressSuggestions(queryText, 5)
  }

  return c.json({ suggestions })
})

app.post('/api/setup/apartments', zValidator('json', apartmentSchema), async (c) => {
  const payload = c.req.valid('json')
  const hasProvidedCoordinates =
    Number.isFinite(payload.latitude) && Number.isFinite(payload.longitude)
  const coordinates = hasProvidedCoordinates
    ? {
        latitude: payload.latitude as number,
        longitude: payload.longitude as number,
      }
    : await geocodeAddress(payload.address)

  await addApartment({
    name: payload.name,
    buildingId: inferBuildingId(payload.address),
    address: payload.address,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    bookingIcalUrl: payload.bookingIcalUrl || null,
    airbnbIcalUrl: payload.airbnbIcalUrl || null,
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
