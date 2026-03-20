import { env } from 'cloudflare:workers'
import { getCookie } from '@tanstack/react-start/server'
import { formatDistanceToNow } from 'date-fns'
import { verifySessionToken, SESSION_COOKIE_NAME } from './auth'
import { formatWeekLabel, getNextWeekStartIso, getWeekRange } from './date'
import {
  countDistancePairs,
  createChangeSet,
  createApartment,
  createCleaner,
  createManualCleanRequest,
  deleteManualCleanRequest,
  getChangeSetById,
  getDistanceMatrix,
  getManualReviewItems,
  getWeekAssignments,
  getWeekRun,
  getWeekRunById,
  latestSyncEvent,
  listApartments,
  listAvailability,
  listBookingsForRange,
  listChangeSets,
  listCleaners,
  listManualRequests,
  markChangeSet,
  recordSyncEvent,
  replaceDistanceMatrix,
  saveWeekPlan,
  updateApartmentCoordinates,
  updateRunStatus,
} from './db'
import { syncICalFeeds } from './ical'
import { sendPushToManager } from './push'
import { buildDayGroups, buildScheduleSummary, buildWeekTasks, diffAssignments, generateAssignments } from './scheduler'
import type { CleanTask, DashboardData, ScheduleAssignment } from './types'

async function isAuthenticated() {
  return verifySessionToken(getCookie(SESSION_COOKIE_NAME), env.SESSION_SECRET)
}

function estimateTravelMinutes(input: {
  sameBuilding: boolean
  from: { latitude: number; longitude: number }
  to: { latitude: number; longitude: number }
}) {
  if (input.sameBuilding) {
    return 4
  }

  const toRadians = (value: number) => (value * Math.PI) / 180
  const latDistance = toRadians(input.to.latitude - input.from.latitude)
  const lngDistance = toRadians(input.to.longitude - input.from.longitude)
  const a =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos(toRadians(input.from.latitude)) *
      Math.cos(toRadians(input.to.latitude)) *
      Math.sin(lngDistance / 2) *
      Math.sin(lngDistance / 2)
  const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.max(6, Math.round((distanceKm / 28) * 60 + 6))
}

async function ensureWeekPlan(weekStart: string) {
  const existingRun = await getWeekRun(weekStart)
  if (existingRun) {
    return existingRun
  }

  const [apartments, cleaners, manualRequests, availability, distanceMatrix] = await Promise.all([
    listApartments(),
    listCleaners(),
    listManualRequests(),
    listAvailability(weekStart),
    getDistanceMatrix(),
  ])
  const { weekEndIso } = getWeekRange(new Date(weekStart))
  const bookings = await listBookingsForRange(weekStart, weekEndIso)
  const tasks = buildWeekTasks({
    weekStart,
    apartments,
    bookings,
    manualRequests,
  })
  const assignments = generateAssignments({
    tasks,
    cleaners,
    availability,
    distanceMatrix,
  })
  const summary = buildScheduleSummary(assignments)
  await saveWeekPlan({
    weekStart,
    status: 'draft',
    summary,
    tasks,
    assignments,
  })

  return getWeekRun(weekStart)
}

export async function getDashboardSnapshot(weekStartOverride?: string): Promise<DashboardData> {
  const authenticated = await isAuthenticated()
  const weekStartIso = weekStartOverride ?? getWeekRange().weekStartIso
  const { weekEndIso } = getWeekRange(new Date(weekStartIso))

  if (!authenticated) {
    return {
      authenticated: false,
      weekStart: weekStartIso,
      weekEnd: weekEndIso,
      weekLabel: formatWeekLabel(weekStartIso),
      weekStatus: null,
      lastSyncedAt: null,
      vapidPublicKey: null,
      apartments: [],
      cleaners: [],
      dayGroups: [],
      changeSets: [],
      manualReviews: [],
      syncSummary: 'Sign in to see this week.',
      distanceMatrixPairs: 0,
      apartmentsMissingCoordinates: 0,
      emptyStateReason: null,
    }
  }

  const [apartments, cleaners, distanceMatrixPairs] = await Promise.all([
    listApartments(),
    listCleaners(),
    countDistancePairs(),
  ])
  const run = apartments.length || cleaners.length ? await ensureWeekPlan(weekStartIso) : null
  const [assignments, changeSets, manualReviews, lastSync] = await Promise.all([
    run ? getWeekAssignments(run.id) : Promise.resolve([]),
    run ? listChangeSets(run.id) : Promise.resolve([]),
    getManualReviewItems(weekStartIso),
    latestSyncEvent(),
  ])

  return {
    authenticated: true,
    weekStart: weekStartIso,
    weekEnd: weekEndIso,
    weekLabel: formatWeekLabel(weekStartIso),
    weekStatus: run?.status ?? null,
    lastSyncedAt: lastSync?.createdAt ?? null,
    vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null,
    apartments,
    cleaners,
    dayGroups: buildDayGroups(assignments, weekStartIso),
    changeSets: changeSets.filter((changeSet) => changeSet.status === 'pending'),
    manualReviews,
    syncSummary: lastSync
      ? `Bookings checked ${formatDistanceToNow(new Date(lastSync.createdAt), { addSuffix: true })}`
      : 'Bookings have not been checked yet.',
    distanceMatrixPairs,
    apartmentsMissingCoordinates: apartments.filter(
      (apartment) => apartment.latitude === null || apartment.longitude === null,
    ).length,
    emptyStateReason:
      apartments.length === 0
        ? 'Add homes and cleaner names to build the first week.'
        : null,
  }
}

export async function addApartment(input: {
  name: string
  colloquialName?: string | null
  buildingId: string
  address: string
  latitude?: number | null
  longitude?: number | null
  icalUrl?: string | null
}) {
  await createApartment(input)
}

async function resolveManualRequestLabel(input: {
  apartmentId?: string | null
  label?: string | null
}) {
  if (input.label?.trim()) {
    return input.label.trim()
  }

  if (input.apartmentId) {
    const apartments = await listApartments()
    const apartment = apartments.find((item) => item.id === input.apartmentId)

    if (apartment) {
      return apartment.colloquialName ?? apartment.name
    }
  }

  throw new Error('Choose an apartment before adding the job')
}

export async function saveApartmentCoordinates(input: {
  apartmentId: string
  latitude: number
  longitude: number
}) {
  await updateApartmentCoordinates(input)
}

export async function addCleaner(input: { name: string; colorHex?: string | null }) {
  await createCleaner(input)
}

export async function addManualRequest(input: {
  label?: string | null
  apartmentId?: string | null
  taskDate?: string | null
  weekday?: number | null
  isRecurring?: boolean
  notes?: string | null
}) {
  await createManualCleanRequest({
    ...input,
    label: await resolveManualRequestLabel(input),
  })
}

export async function addManualRequestToWeek(input: {
  weekStart?: string
  label?: string | null
  apartmentId?: string | null
  taskDate: string
  notes?: string | null
}) {
  const weekStartIso = input.weekStart ?? getWeekRange().weekStartIso
  const { weekEndIso } = getWeekRange(new Date(weekStartIso))

  await createManualCleanRequest({
    label: await resolveManualRequestLabel(input),
    apartmentId: input.apartmentId ?? null,
    taskDate: input.taskDate,
    isRecurring: false,
    notes: input.notes ?? null,
  })

  const [apartments, cleaners, manualRequests, availability, distanceMatrix] = await Promise.all([
    listApartments(),
    listCleaners(),
    listManualRequests(),
    listAvailability(weekStartIso),
    getDistanceMatrix(),
  ])

  const run = apartments.length || cleaners.length ? await ensureWeekPlan(weekStartIso) : null

  if (!run) {
    throw new Error('Add homes and cleaner names before adding jobs to the week')
  }

  const bookings = await listBookingsForRange(weekStartIso, weekEndIso)
  const tasks = buildWeekTasks({
    weekStart: weekStartIso,
    apartments,
    bookings,
    manualRequests,
  })
  const assignments = generateAssignments({
    tasks,
    cleaners,
    availability,
    distanceMatrix,
  })
  const summary = buildScheduleSummary(assignments)

  await saveWeekPlan({
    weekStart: weekStartIso,
    status: run.status,
    summary,
    tasks,
    assignments,
  })
}

export async function confirmCurrentWeek(weekStartOverride?: string) {
  const weekStartIso = weekStartOverride ?? getWeekRange().weekStartIso
  await updateRunStatus(weekStartIso, 'confirmed')
}

export async function rejectSuggestedChange(changeSetId: string) {
  const changeSet = await getChangeSetById(changeSetId)
  if (!changeSet) {
    return
  }

  await markChangeSet(changeSetId, 'rejected')
  const run = await getWeekRunById(changeSet.scheduleRunId)
  if (run?.status === 'needs_review') {
    await updateRunStatus(run.weekStart, 'confirmed')
  }
}

export async function approveSuggestedChange(changeSetId: string) {
  const changeSet = await getChangeSetById(changeSetId)
  if (!changeSet) {
    throw new Error('Suggestion not found')
  }

  const run = await getWeekRunById(changeSet.scheduleRunId)
  const weekStart = run?.weekStart ?? getWeekRange().weekStartIso

  await saveWeekPlan({
    weekStart,
    status: 'confirmed',
    summary: changeSet.summary,
    tasks: changeSet.payload.tasks,
    assignments: changeSet.payload.assignments.map((assignment) => ({
      ...assignment,
      source: 'approved_patch',
    })),
  })
  await markChangeSet(changeSetId, 'approved')
  await updateRunStatus(weekStart, 'confirmed', changeSet.summary)
}

function rebuildTasksFromAssignments(assignments: ScheduleAssignment[]): CleanTask[] {
  return assignments.map((assignment) => ({
    id: assignment.cleanTaskId,
    apartmentId: assignment.apartmentId,
    apartmentName: assignment.apartmentName,
    buildingId: assignment.buildingId,
    taskDate: assignment.taskDate,
    taskType: assignment.taskType,
    sourceBookingId: assignment.sourceBookingId ?? null,
    sourceManualRequestId: assignment.sourceManualRequestId ?? null,
    notes: assignment.notes,
    requiresReview: assignment.taskType === 'midstay_review',
  }))
}

function resortAssignments(assignments: ScheduleAssignment[]) {
  const sorted = [...assignments].sort((left, right) => {
    if (left.taskDate === right.taskDate) {
      return left.apartmentName.localeCompare(right.apartmentName)
    }

    return left.taskDate.localeCompare(right.taskDate)
  })

  const dayCounts = new Map<string, number>()

  return sorted.map((assignment) => {
    const currentCount = dayCounts.get(assignment.taskDate) ?? 0
    dayCounts.set(assignment.taskDate, currentCount + 1)

    return {
      ...assignment,
      sortOrder: currentCount,
    }
  })
}

export async function applyQuickScheduleEdit(input: {
  weekStart?: string
  assignmentId: string
  cleanerId?: string | null
  notes?: string | null
  taskDate?: string
}) {
  const weekStartIso = input.weekStart ?? getWeekRange().weekStartIso
  const run = await ensureWeekPlan(weekStartIso)

  if (!run) {
    throw new Error('No week plan is available yet')
  }

  const [assignments, cleaners] = await Promise.all([getWeekAssignments(run.id), listCleaners()])
  const cleanerById = new Map(cleaners.map((cleaner) => [cleaner.id, cleaner]))
  const currentAssignment = assignments.find((assignment) => assignment.id === input.assignmentId)

  if (!currentAssignment) {
    throw new Error('The selected job could not be found')
  }

  const nextAssignments = resortAssignments(
    assignments.map((assignment) => {
      if (assignment.id !== input.assignmentId) {
        return assignment
      }

      const cleaner =
        input.cleanerId === undefined
          ? assignment.cleanerId
            ? cleanerById.get(assignment.cleanerId) ?? null
            : null
          : input.cleanerId
            ? cleanerById.get(input.cleanerId) ?? null
            : null

      return {
        ...assignment,
        cleanerId: cleaner?.id ?? null,
        cleanerName: cleaner?.name ?? null,
        notes: input.notes ?? assignment.notes,
        taskDate: input.taskDate ?? assignment.taskDate,
        source: 'manual' as const,
      }
    }),
  )

  const changes = diffAssignments(assignments, nextAssignments)

  const notesChanged = (input.notes ?? currentAssignment.notes) !== currentAssignment.notes
  const dateChanged = (input.taskDate ?? currentAssignment.taskDate) !== currentAssignment.taskDate
  const cleanerChanged =
    (input.cleanerId === undefined ? currentAssignment.cleanerId : input.cleanerId ?? null) !==
    currentAssignment.cleanerId

  if (!changes.length && !notesChanged && !dateChanged && !cleanerChanged) {
    throw new Error('Nothing changed')
  }

  const summary = buildScheduleSummary(nextAssignments)

  await saveWeekPlan({
    weekStart: weekStartIso,
    status: run.status,
    summary,
    tasks: rebuildTasksFromAssignments(nextAssignments),
    assignments: nextAssignments,
  })
}

export async function deleteScheduleAssignment(input: {
  weekStart?: string
  assignmentId: string
}) {
  const weekStartIso = input.weekStart ?? getWeekRange().weekStartIso
  const { weekEndIso } = getWeekRange(new Date(weekStartIso))
  const run = await ensureWeekPlan(weekStartIso)

  if (!run) {
    throw new Error('No week plan is available yet')
  }

  const assignments = await getWeekAssignments(run.id)
  const currentAssignment = assignments.find((assignment) => assignment.id === input.assignmentId)

  if (!currentAssignment) {
    throw new Error('The selected job could not be found')
  }

  if (currentAssignment.sourceManualRequestId) {
    await deleteManualCleanRequest(currentAssignment.sourceManualRequestId)

    const [apartments, cleaners, manualRequests, availability, distanceMatrix] = await Promise.all([
      listApartments(),
      listCleaners(),
      listManualRequests(),
      listAvailability(weekStartIso),
      getDistanceMatrix(),
    ])
    const bookings = await listBookingsForRange(weekStartIso, weekEndIso)
    const tasks = buildWeekTasks({
      weekStart: weekStartIso,
      apartments,
      bookings,
      manualRequests,
    })
    const nextAssignments = generateAssignments({
      tasks,
      cleaners,
      availability,
      distanceMatrix,
    })
    const summary = buildScheduleSummary(nextAssignments)

    await saveWeekPlan({
      weekStart: weekStartIso,
      status: run.status,
      summary,
      tasks,
      assignments: nextAssignments,
    })
    return
  }

  const nextAssignments = assignments.filter((assignment) => assignment.id !== input.assignmentId)
  const summary = buildScheduleSummary(nextAssignments)

  await saveWeekPlan({
    weekStart: weekStartIso,
    status: run.status,
    summary,
    tasks: rebuildTasksFromAssignments(nextAssignments),
    assignments: nextAssignments,
  })
}

export async function seedDistanceMatrix() {
  const apartments = (await listApartments()).filter(
    (apartment) => apartment.latitude !== null && apartment.longitude !== null,
  )

  if (apartments.length < 2) {
    throw new Error('Add coordinates to at least two apartments before seeding the matrix')
  }

  const entries: Array<{ fromApartmentId: string; toApartmentId: string; minutes: number }> = []

  for (const fromApartment of apartments) {
    for (const toApartment of apartments) {
      const minutes = estimateTravelMinutes({
        sameBuilding: fromApartment.buildingId === toApartment.buildingId,
        from: {
          latitude: fromApartment.latitude!,
          longitude: fromApartment.longitude!,
        },
        to: {
          latitude: toApartment.latitude!,
          longitude: toApartment.longitude!,
        },
      })

      entries.push({
        fromApartmentId: fromApartment.id,
        toApartmentId: toApartment.id,
        minutes,
      })
    }
  }

  await replaceDistanceMatrix(entries)
  await recordSyncEvent('distance-matrix-seed', 'ok', {
    apartments: apartments.length,
    pairs: entries.length,
    mode: 'estimated-haversine',
  })
}

export async function regenerateWeekFromICal(
  trigger: 'cron' | 'manual',
  weekStartOverride?: string,
) {
  const weekStartIso = weekStartOverride ?? getWeekRange().weekStartIso
  const { weekEndIso } = getWeekRange(new Date(weekStartIso))
  const [apartments, cleaners, manualRequests, availability, distanceMatrix] = await Promise.all([
    listApartments(),
    listCleaners(),
    listManualRequests(),
    listAvailability(weekStartIso),
    getDistanceMatrix(),
  ])

  const run = apartments.length || cleaners.length ? await ensureWeekPlan(weekStartIso) : null
  const currentAssignments = run ? await getWeekAssignments(run.id) : []
  await syncICalFeeds()
  const bookings = await listBookingsForRange(weekStartIso, weekEndIso)
  const tasks = buildWeekTasks({
    weekStart: weekStartIso,
    apartments,
    bookings,
    manualRequests,
  })
  const nextAssignments = generateAssignments({
    tasks,
    cleaners,
    availability,
    distanceMatrix,
  })
  const changes = diffAssignments(currentAssignments, nextAssignments)
  const summary = buildScheduleSummary(nextAssignments)

  if (!run) {
    await saveWeekPlan({
      weekStart: weekStartIso,
      status: 'draft',
      summary,
      tasks,
      assignments: nextAssignments,
    })
    await sendPushToManager({
      title: 'StayClean draft ready',
      body:
        trigger === 'cron' && weekStartOverride === getNextWeekStartIso()
          ? 'Next week is drafted and ready to review in the PWA.'
          : 'Your current week draft is ready to review in the PWA.',
      url: env.APP_BASE_URL ?? '/',
    })
    return
  }

  if (run.status !== 'confirmed') {
    await saveWeekPlan({
      weekStart: weekStartIso,
      status: 'draft',
      summary,
      tasks,
      assignments: nextAssignments,
    })
    await recordSyncEvent('ical-impact-check', 'draft-updated', {
      trigger,
      changedAssignments: changes.length,
    })
    return
  }

  if (!changes.length) {
    await recordSyncEvent('ical-impact-check', 'ok', {
      trigger,
      changedAssignments: 0,
    })
    return
  }

  await createChangeSet({
    scheduleRunId: run.id,
    source: 'ical',
    title: 'iCal update changed this week',
    summary,
    payload: {
      title: 'iCal update changed this week',
      summary,
      tasks,
      assignments: nextAssignments,
      changes,
    },
  })
  await updateRunStatus(weekStartIso, 'needs_review')
  await recordSyncEvent('ical-impact-check', 'pending-review', {
    trigger,
    changedAssignments: changes.length,
  })
  await sendPushToManager({
    title: 'StayClean needs review',
    body: `${changes.length} schedule change${changes.length === 1 ? '' : 's'} need approval for ${formatWeekLabel(
      weekStartIso,
    )}.`,
    url: env.APP_BASE_URL ?? '/',
  })
}
