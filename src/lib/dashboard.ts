import { env } from 'cloudflare:workers'
import { getCookie } from '@tanstack/react-start/server'
import { formatDistanceToNow } from 'date-fns'
import { verifySessionToken, SESSION_COOKIE_NAME } from './auth'
import { generateChatProposal, applyChatProposal } from './ai'
import { formatWeekLabel, getWeekRange, getNextWeekStartIso } from './date'
import {
  createChangeSet,
  createApartment,
  createCleaner,
  createManualCleanRequest,
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
  saveWeekPlan,
  updateRunStatus,
} from './db'
import { syncICalFeeds } from './ical'
import { sendPushToManager } from './push'
import { buildDayGroups, buildScheduleSummary, buildWeekTasks, diffAssignments, generateAssignments } from './scheduler'
import type { DashboardData } from './types'

async function isAuthenticated() {
  return verifySessionToken(getCookie(SESSION_COOKIE_NAME), env.SESSION_SECRET)
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

export async function getDashboardSnapshot(): Promise<DashboardData> {
  const authenticated = await isAuthenticated()
  const { weekStartIso, weekEndIso } = getWeekRange()

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
      syncSummary: 'Sign in to see the current week.',
      emptyStateReason: null,
    }
  }

  const [apartments, cleaners] = await Promise.all([listApartments(), listCleaners()])
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
      ? `Last sync ${formatDistanceToNow(new Date(lastSync.createdAt), { addSuffix: true })}`
      : 'No iCal sync has run yet.',
    emptyStateReason:
      apartments.length === 0
        ? 'Add apartments and cleaner names to generate the first draft week.'
        : null,
  }
}

export async function addApartment(input: {
  name: string
  buildingId: string
  address: string
  icalUrl?: string | null
}) {
  await createApartment(input)
}

export async function addCleaner(input: { name: string; colorHex?: string | null }) {
  await createCleaner(input)
}

export async function addManualRequest(input: {
  label: string
  apartmentId?: string | null
  taskDate?: string | null
  weekday?: number | null
  isRecurring?: boolean
  notes?: string | null
}) {
  await createManualCleanRequest(input)
}

export async function confirmCurrentWeek() {
  const { weekStartIso } = getWeekRange()
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

export async function createChatSuggestion(message: string) {
  const { weekStartIso } = getWeekRange()
  const run = await ensureWeekPlan(weekStartIso)
  if (!run) {
    throw new Error('No week plan is available yet')
  }

  const assignments = await getWeekAssignments(run.id)
  const proposal = await generateChatProposal({
    message,
    currentAssignments: assignments,
  })

  const nextAssignments = applyChatProposal({
    proposal,
    assignments,
  }).map((assignment) => {
    const cleaner = assignment.cleanerName
      ? assignment.cleanerName
      : null
    return {
      ...assignment,
      cleanerName: cleaner,
    }
  })

  const cleaners = await listCleaners()
  const cleanerByName = new Map(cleaners.map((cleaner) => [cleaner.name.toLowerCase(), cleaner]))
  const normalizedAssignments = nextAssignments.map((assignment) => ({
    ...assignment,
    cleanerId: assignment.cleanerName
      ? cleanerByName.get(assignment.cleanerName.toLowerCase())?.id ?? null
      : null,
  }))
  const changes = diffAssignments(assignments, normalizedAssignments)

  if (!changes.length) {
    throw new Error('The request did not change the current schedule')
  }

  await createChangeSet({
    scheduleRunId: run.id,
    source: 'chat',
    title: proposal.title,
    summary: proposal.summary,
    payload: {
      title: proposal.title,
      summary: proposal.summary,
      tasks: assignments.map((assignment) => ({
        id: assignment.cleanTaskId,
        apartmentId: assignment.apartmentId,
        apartmentName: assignment.apartmentName,
        buildingId: assignment.buildingId,
        taskDate: assignment.taskDate,
        taskType: assignment.taskType,
        notes: assignment.notes,
        requiresReview: false,
      })),
      assignments: normalizedAssignments,
      changes,
    },
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
