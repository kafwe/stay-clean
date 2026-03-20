import ICAL from 'ical.js'
import { addDays } from 'date-fns'
import { getWeekRange, toIsoDate } from './date'
import { listApartments, recordSyncEvent, upsertBookings } from './db'
import type { Booking } from './types'

function stableHash(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return `${hash}`
}

function parseFeed(apartmentId: string, source: string): Booking[] {
  const component = new ICAL.Component(ICAL.parse(source))
  const events = component.getAllSubcomponents('vevent')

  return events
    .map((entry) => new ICAL.Event(entry))
    .filter((event) => event.startDate && event.endDate)
    .map((event) => {
      const checkIn = event.startDate.toJSDate()
      const checkOut = event.endDate.toJSDate()
      const summary = event.summary ?? 'Guest'
      const rawHash = stableHash(
        [event.uid, checkIn.toISOString(), checkOut.toISOString(), summary].join('|'),
      )

      return {
        id: crypto.randomUUID(),
        apartmentId,
        externalRef: event.uid ?? null,
        guestName: summary,
        checkIn: toIsoDate(checkIn),
        checkOut: toIsoDate(checkOut),
        nights: Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000)),
        rawHash,
      }
    })
}

export async function syncICalFeeds() {
  const apartments = await listApartments()
  const candidates = apartments.filter((apartment) => apartment.icalUrl)
  const results: Array<{ apartmentName: string; updated: number }> = []

  for (const apartment of candidates) {
    try {
      const response = await fetch(apartment.icalUrl!)
      if (!response.ok) {
        throw new Error(`Feed returned ${response.status}`)
      }

      const text = await response.text()
      const bookings = parseFeed(apartment.id, text).filter((booking) => {
        const lookback = addDays(getWeekRange().weekStart, -14)
        return booking.checkOut >= toIsoDate(lookback)
      })

      await upsertBookings(apartment.id, bookings)
      results.push({ apartmentName: apartment.name, updated: bookings.length })
    } catch (error) {
      results.push({
        apartmentName: apartment.name,
        updated: 0,
      })
      await recordSyncEvent('ical-sync-error', 'error', {
        apartmentId: apartment.id,
        apartmentName: apartment.name,
        message: error instanceof Error ? error.message : 'Unknown iCal sync error',
      })
    }
  }

  await recordSyncEvent('ical-sync', 'ok', {
    apartments: results.length,
    results,
  })

  return results
}
