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

function parseFeed(apartmentId: string, sourceName: 'booking' | 'airbnb', source: string): Booking[] {
  const component = new ICAL.Component(ICAL.parse(source))
  const events = component.getAllSubcomponents('vevent')

  return events
    .map((entry) => new ICAL.Event(entry))
    .filter((event) => event.startDate && event.endDate)
    .map((event) => {
      const checkIn = event.startDate.toJSDate()
      const checkOut = event.endDate.toJSDate()
      const summary = event.summary ?? 'Guest'
      const eventUrl = event.component.getFirstPropertyValue('url')
      const bookingUrl =
        typeof eventUrl === 'string' && /^https?:\/\//i.test(eventUrl)
          ? eventUrl
          : null
      const rawHash = stableHash(
        [sourceName, event.uid, checkIn.toISOString(), checkOut.toISOString(), summary].join('|'),
      )

      return {
        id: crypto.randomUUID(),
        apartmentId,
        source: sourceName,
        bookingUrl,
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
  const candidates = apartments.filter(
    (apartment) => apartment.bookingIcalUrl || apartment.airbnbIcalUrl,
  )
  const results: Array<{ apartmentName: string; updated: number; feeds: number }> = []

  for (const apartment of candidates) {
    try {
      const feedUrls: Array<{ name: 'booking' | 'airbnb'; url: string }> = []

      if (apartment.bookingIcalUrl) {
        feedUrls.push({ name: 'booking', url: apartment.bookingIcalUrl })
      }

      if (apartment.airbnbIcalUrl) {
        feedUrls.push({ name: 'airbnb', url: apartment.airbnbIcalUrl })
      }

      const allBookings: Booking[] = []
      for (const feed of feedUrls) {
        const response = await fetch(feed.url)
        if (!response.ok) {
          throw new Error(`${feed.name} feed returned ${response.status}`)
        }

        const text = await response.text()
        const bookings = parseFeed(apartment.id, feed.name, text).filter((booking) => {
          const lookback = addDays(getWeekRange().weekStart, -14)
          return booking.checkOut >= toIsoDate(lookback)
        })

        allBookings.push(...bookings)
      }

      await upsertBookings(apartment.id, allBookings)
      results.push({ apartmentName: apartment.name, updated: allBookings.length, feeds: feedUrls.length })
    } catch (error) {
      results.push({
        apartmentName: apartment.name,
        updated: 0,
        feeds:
          Number(Boolean(apartment.bookingIcalUrl)) + Number(Boolean(apartment.airbnbIcalUrl)),
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
