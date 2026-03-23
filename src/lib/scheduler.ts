import { formatDayLabel, weekDates, weekdayIndex } from './date'
import type {
  Apartment,
  Booking,
  Cleaner,
  CleanerAvailability,
  CleanTask,
  ManualCleanRequest,
  ScheduleAssignment,
  ScheduleChange,
} from './types'

export function buildWeekTasks(input: {
  weekStart: string
  apartments: Apartment[]
  bookings: Booking[]
  manualRequests: ManualCleanRequest[]
}) {
  const apartmentMap = new Map(input.apartments.map((apartment) => [apartment.id, apartment]))
  const tasks: CleanTask[] = []

  for (const booking of input.bookings) {
    const apartment = apartmentMap.get(booking.apartmentId)
    if (!apartment) {
      continue
    }

    if (weekDates(input.weekStart).includes(booking.checkOut)) {
      tasks.push({
        id: crypto.randomUUID(),
        apartmentId: apartment.id,
        apartmentName: apartment.colloquialName ?? apartment.name,
        buildingId: apartment.buildingId,
        taskDate: booking.checkOut,
        taskType: 'checkout_clean',
        sourceBookingId: booking.id,
        bookingSource: booking.source,
        bookingUrl: booking.bookingUrl,
        sourceManualRequestId: null,
        notes: booking.guestName ? `Checkout: ${booking.guestName}` : 'Checkout clean',
        requiresReview: false,
      })
    }

    if (booking.nights > 7 && weekDates(input.weekStart).includes(booking.checkOut)) {
      tasks.push({
        id: crypto.randomUUID(),
        apartmentId: apartment.id,
        apartmentName: apartment.colloquialName ?? apartment.name,
        buildingId: apartment.buildingId,
        taskDate: booking.checkOut,
        taskType: 'midstay_review',
        sourceBookingId: booking.id,
        bookingSource: booking.source,
        bookingUrl: booking.bookingUrl,
        sourceManualRequestId: null,
        notes: 'Long stay flagged for manual review',
        requiresReview: true,
      })
    }
  }

  for (const request of input.manualRequests.filter((item) => item.isActive)) {
    if (request.isRecurring && request.weekday !== null) {
      const matchingDate = weekDates(input.weekStart).find(
        (date) => weekdayIndex(date) === request.weekday,
      )

      if (matchingDate) {
        const apartment = request.apartmentId
          ? apartmentMap.get(request.apartmentId)
          : undefined
        tasks.push({
          id: crypto.randomUUID(),
          apartmentId: apartment?.id ?? null,
          apartmentName: apartment?.colloquialName ?? apartment?.name ?? request.label,
          buildingId: apartment?.buildingId ?? null,
          taskDate: matchingDate,
          taskType: 'external_clean',
          sourceBookingId: null,
          sourceManualRequestId: request.id,
          notes: request.notes ?? request.label,
          requiresReview: false,
        })
      }
    }

    if (!request.isRecurring && request.taskDate && weekDates(input.weekStart).includes(request.taskDate)) {
      const apartment = request.apartmentId ? apartmentMap.get(request.apartmentId) : undefined
      tasks.push({
        id: crypto.randomUUID(),
        apartmentId: apartment?.id ?? null,
        apartmentName: apartment?.colloquialName ?? apartment?.name ?? request.label,
        buildingId: apartment?.buildingId ?? null,
        taskDate: request.taskDate,
        taskType: 'external_clean',
        sourceBookingId: null,
        sourceManualRequestId: request.id,
        notes: request.notes ?? request.label,
        requiresReview: false,
      })
    }
  }

  return tasks.sort((a, b) => {
    if (a.taskDate === b.taskDate) {
      return a.apartmentName.localeCompare(b.apartmentName)
    }

    return a.taskDate.localeCompare(b.taskDate)
  })
}

function buildAvailabilityMap(availability: CleanerAvailability[]) {
  return new Map(availability.map((item) => [`${item.cleanerId}:${item.date}`, item.status]))
}

function distanceBetween(
  distanceMatrix: Map<string, number>,
  fromApartmentId: string | null,
  toApartmentId: string | null,
) {
  if (!fromApartmentId || !toApartmentId || fromApartmentId === toApartmentId) {
    return 0
  }

  return (
    distanceMatrix.get(`${fromApartmentId}:${toApartmentId}`) ??
    distanceMatrix.get(`${toApartmentId}:${fromApartmentId}`) ??
    18
  )
}

export function generateAssignments(input: {
  tasks: CleanTask[]
  cleaners: Cleaner[]
  availability: CleanerAvailability[]
  distanceMatrix: Map<string, number>
}) {
  const activeCleaners = input.cleaners.filter((cleaner) => cleaner.isActive)
  const availabilityMap = buildAvailabilityMap(input.availability)
  const weeklyLoad = new Map(activeCleaners.map((cleaner) => [cleaner.id, 0]))
  const assignments: ScheduleAssignment[] = []

  for (const date of [...new Set(input.tasks.map((task) => task.taskDate))]) {
    const dailyTasks = input.tasks.filter(
      (task) => task.taskDate === date && task.taskType !== 'midstay_review',
    )

    const available = activeCleaners.filter((cleaner) => {
      return availabilityMap.get(`${cleaner.id}:${date}`) !== 'off'
    })

    const cleanerState = new Map(
      available.map((cleaner) => [
        cleaner.id,
        {
          lastApartmentId: null as string | null,
          dayCount: 0,
        },
      ]),
    )

    const byBuilding = new Map<string, CleanTask[]>()
    for (const task of dailyTasks) {
      const key = task.buildingId ?? `solo:${task.id}`
      const group = byBuilding.get(key) ?? []
      group.push(task)
      byBuilding.set(key, group)
    }

    const orderedTasks = [...byBuilding.values()]
      .sort((left, right) => right.length - left.length)
      .flatMap((group) => group)

    for (const task of orderedTasks) {
      const groupedCount = task.buildingId ? byBuilding.get(task.buildingId)?.length ?? 1 : 1
      const enforceSplit = groupedCount > 2 && available.length > 1
      const alreadyUsedInBuilding = new Set(
        assignments
          .filter((row) => row.taskDate === date && row.buildingId === task.buildingId)
          .map((row) => row.cleanerId)
          .filter(Boolean) as string[],
      )

      const candidates = available.length ? available : activeCleaners
      const scored = candidates.map((cleaner) => {
        const weeklyCount = weeklyLoad.get(cleaner.id) ?? 0
        const state = cleanerState.get(cleaner.id) ?? {
          lastApartmentId: null as string | null,
          dayCount: 0,
        }

        const travelScore = distanceBetween(
          input.distanceMatrix,
          state.lastApartmentId,
          task.apartmentId,
        )
        const buildingBonus =
          task.buildingId && assignments.some(
            (row) =>
              row.taskDate === date &&
              row.cleanerId === cleaner.id &&
              row.buildingId === task.buildingId,
          )
            ? -6
            : 0
        const splitPenalty =
          enforceSplit && alreadyUsedInBuilding.has(cleaner.id) && alreadyUsedInBuilding.size < 2
            ? 12
            : 0

        return {
          cleaner,
          score: weeklyCount * 14 + state.dayCount * 8 + travelScore + splitPenalty + buildingBonus,
        }
      })

      const best = scored.sort((left, right) => left.score - right.score)[0]

      assignments.push({
        id: crypto.randomUUID(),
        cleanTaskId: task.id,
        apartmentId: task.apartmentId,
        apartmentName: task.apartmentName,
        buildingId: task.buildingId,
        taskDate: task.taskDate,
        cleanerId: best?.cleaner.id ?? null,
        cleanerName: best?.cleaner.name ?? null,
        cleanerColorHex: best?.cleaner.colorHex ?? null,
        sortOrder: assignments.filter((row) => row.taskDate === task.taskDate).length,
        source: 'auto',
        sourceBookingId: task.sourceBookingId ?? null,
        bookingSource: task.bookingSource ?? null,
        bookingUrl: task.bookingUrl ?? null,
        sourceManualRequestId: task.sourceManualRequestId ?? null,
        notes: task.notes,
        taskType: task.taskType,
      })

      if (best) {
        weeklyLoad.set(best.cleaner.id, (weeklyLoad.get(best.cleaner.id) ?? 0) + 1)
        cleanerState.set(best.cleaner.id, {
          lastApartmentId: task.apartmentId,
          dayCount: (cleanerState.get(best.cleaner.id)?.dayCount ?? 0) + 1,
        })
      }
    }
  }

  return assignments
}

export function diffAssignments(
  currentAssignments: ScheduleAssignment[],
  nextAssignments: ScheduleAssignment[],
): ScheduleChange[] {
  const currentMap = new Map(
    currentAssignments.map((row) => [`${row.taskDate}:${row.apartmentName}`, row]),
  )
  const nextMap = new Map(nextAssignments.map((row) => [`${row.taskDate}:${row.apartmentName}`, row]))
  const keys = new Set([...currentMap.keys(), ...nextMap.keys()])
  const changes: ScheduleChange[] = []

  for (const key of keys) {
    const current = currentMap.get(key)
    const next = nextMap.get(key)

    if (current && !next) {
      changes.push({
        apartmentName: current.apartmentName,
        date: current.taskDate,
        beforeCleaner: current.cleanerName,
        afterCleaner: null,
        reason: 'removed',
      })
      continue
    }

    if (!current && next) {
      changes.push({
        apartmentName: next.apartmentName,
        date: next.taskDate,
        beforeCleaner: null,
        afterCleaner: next.cleanerName,
        reason: 'added',
      })
      continue
    }

    if (current && next && current.cleanerName !== next.cleanerName) {
      changes.push({
        apartmentName: next.apartmentName,
        date: next.taskDate,
        beforeCleaner: current.cleanerName,
        afterCleaner: next.cleanerName,
        reason: 'reassigned',
      })
    }
  }

  return changes.sort((left, right) => {
    if (left.date === right.date) {
      return left.apartmentName.localeCompare(right.apartmentName)
    }
    return left.date.localeCompare(right.date)
  })
}

export function buildScheduleSummary(assignments: ScheduleAssignment[]) {
  if (!assignments.length) {
    return 'No cleaning tasks scheduled for this week yet.'
  }

  const days = new Set(assignments.map((assignment) => assignment.taskDate)).size
  const cleaners = new Set(assignments.map((assignment) => assignment.cleanerName).filter(Boolean)).size
  return `${assignments.length} cleans across ${days} day${days === 1 ? '' : 's'} with ${cleaners || 0} cleaner${cleaners === 1 ? '' : 's'} assigned.`
}

export function buildDayGroups(assignments: ScheduleAssignment[], weekStart: string) {
  return weekDates(weekStart).map((date) => {
    const rows = assignments.filter((assignment) => assignment.taskDate === date)
    return {
      date,
      label: formatDayLabel(date),
      rows,
      isEmpty: rows.length === 0,
    }
  })
}
