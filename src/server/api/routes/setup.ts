import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  addApartment,
  addCleaner,
  addManualRequest,
  addManualRequestToWeek,
  deleteApartment,
  deleteCleaner,
  saveApartmentCoordinates,
  seedDistanceMatrix,
  updateCleanerName,
  updateCleanerWeekAvailability,
} from '#/lib/dashboard'
import {
  apartmentSchema,
  cleanerAvailabilitySchema,
  cleanerSchema,
  cleanerUpdateSchema,
  manualSchema,
} from '#/lib/validation'
import { queueDistanceMatrixSeed } from '../services/distance-matrix'
import { geocodeAddress, inferBuildingId } from '../services/places'
import type { ApiApp } from '../types'

export function registerSetupRoutes(app: ApiApp) {
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

    queueDistanceMatrixSeed(c)

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

      queueDistanceMatrixSeed(c)

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
      colorHex: payload.colorHex,
    })
    return c.json({ ok: true })
  })

  app.post('/api/setup/cleaners/availability', zValidator('json', cleanerAvailabilitySchema), async (c) => {
    await updateCleanerWeekAvailability(c.req.valid('json'))
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

  app.post('/api/setup/distance-matrix/seed', async (c) => {
    const result = await seedDistanceMatrix()
    return c.json(result)
  })
}