import { env } from 'cloudflare:workers'
import { addDays, parseISO } from 'date-fns'
import { toIsoDate } from './date'
import type {
  Apartment,
  Booking,
  ChangePayload,
  ChangeSet,
  Cleaner,
  CleanerAvailability,
  CleanTask,
  ManualCleanRequest,
  ManualReviewItem,
  ScheduleAssignment,
  ScheduleRun,
  ScheduleStatus,
  SyncEvent,
} from './types'

function db(): D1Database {
  return env.DB
}

function isMissingTableError(error: unknown) {
  return error instanceof Error && /no such table/i.test(error.message)
}

async function all<T>(query: string, bindings: unknown[] = []): Promise<T[]> {
  try {
    const result = await db().prepare(query).bind(...bindings).all<T>()
    return result.results ?? []
  } catch (error) {
    if (isMissingTableError(error)) {
      return [] as T[]
    }

    throw error
  }
}

async function first<T>(query: string, bindings: unknown[] = []): Promise<T | null> {
  const results = await all<T>(query, bindings)
  return results[0] ?? null
}

async function run(query: string, bindings: unknown[] = []) {
  return db().prepare(query).bind(...bindings).run()
}

function bool(value: unknown) {
  return Number(value) === 1
}

export async function listApartments(): Promise<Apartment[]> {
  const rows = await all<{
    id: string
    name: string
    building_id: string
    address: string
    ical_url: string | null
    is_external: number
    notes: string | null
  }>(
    `SELECT id, name, building_id, address, ical_url, is_external, notes
     FROM apartments
     ORDER BY name ASC`,
  )

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    buildingId: row.building_id,
    address: row.address,
    icalUrl: row.ical_url,
    isExternal: bool(row.is_external),
    notes: row.notes,
  }))
}

export async function listCleaners(): Promise<Cleaner[]> {
  const rows = await all<{
    id: string
    name: string
    color_hex: string | null
    is_active: number
  }>(
    `SELECT id, name, color_hex, is_active
     FROM cleaners
     ORDER BY is_active DESC, name ASC`,
  )

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    colorHex: row.color_hex,
    isActive: bool(row.is_active),
  }))
}

export async function listAvailability(weekStartIso: string): Promise<CleanerAvailability[]> {
  const weekEndIso = toIsoDate(addDays(parseISO(weekStartIso), 6))

  const rows = await all<{
    cleaner_id: string
    date: string
    status: 'available' | 'off'
  }>(
    `SELECT cleaner_id, date, status
     FROM cleaner_availability
     WHERE date BETWEEN ? AND ?`,
    [weekStartIso, weekEndIso],
  )

  return rows.map((row) => ({
    cleanerId: row.cleaner_id,
    date: row.date,
    status: row.status,
  }))
}

export async function listManualRequests(): Promise<ManualCleanRequest[]> {
  const rows = await all<{
    id: string
    label: string
    apartment_id: string | null
    task_date: string | null
    weekday: number | null
    is_recurring: number
    notes: string | null
    is_active: number
  }>(
    `SELECT id, label, apartment_id, task_date, weekday, is_recurring, notes, is_active
     FROM manual_clean_requests
     ORDER BY is_active DESC, label ASC`,
  )

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    apartmentId: row.apartment_id,
    taskDate: row.task_date,
    weekday: row.weekday,
    isRecurring: bool(row.is_recurring),
    notes: row.notes,
    isActive: bool(row.is_active),
  }))
}

export async function listBookingsForRange(
  startIso: string,
  endIso: string,
): Promise<Booking[]> {
  const rows = await all<{
    id: string
    apartment_id: string
    external_ref: string | null
    guest_name: string | null
    check_in: string
    check_out: string
    nights: number
    raw_hash: string
  }>(
    `SELECT id, apartment_id, external_ref, guest_name, check_in, check_out, nights, raw_hash
     FROM bookings
     WHERE check_out BETWEEN ? AND ? OR check_in BETWEEN ? AND ?`,
    [startIso, endIso, startIso, endIso],
  )

  return rows.map((row) => ({
    id: row.id,
    apartmentId: row.apartment_id,
    externalRef: row.external_ref,
    guestName: row.guest_name,
    checkIn: row.check_in,
    checkOut: row.check_out,
    nights: row.nights,
    rawHash: row.raw_hash,
  }))
}

export async function getDistanceMatrix(): Promise<Map<string, number>> {
  const rows = await all<{
    from_apartment_id: string
    to_apartment_id: string
    minutes: number
  }>(
    `SELECT from_apartment_id, to_apartment_id, minutes
     FROM distance_matrix`,
  )

  return new Map<string, number>(
    rows.map((row) => [`${row.from_apartment_id}:${row.to_apartment_id}`, row.minutes]),
  )
}

export async function getWeekRun(weekStartIso: string): Promise<ScheduleRun | null> {
  const row = await first<{
    id: string
    week_start: string
    status: ScheduleStatus
    summary: string | null
  }>(
    `SELECT id, week_start, status, summary
     FROM schedule_runs
     WHERE week_start = ?`,
    [weekStartIso],
  )

  if (!row) {
    return null
  }

  return {
    id: row.id,
    weekStart: row.week_start,
    status: row.status,
    summary: row.summary,
  }
}

export async function getWeekRunById(scheduleRunId: string): Promise<ScheduleRun | null> {
  const row = await first<{
    id: string
    week_start: string
    status: ScheduleStatus
    summary: string | null
  }>(
    `SELECT id, week_start, status, summary
     FROM schedule_runs
     WHERE id = ?`,
    [scheduleRunId],
  )

  if (!row) {
    return null
  }

  return {
    id: row.id,
    weekStart: row.week_start,
    status: row.status,
    summary: row.summary,
  }
}

export async function getWeekAssignments(scheduleRunId: string): Promise<ScheduleAssignment[]> {
  const rows = await all<{
    id: string
    clean_task_id: string
    apartment_id: string | null
    apartment_name: string | null
    building_id: string | null
    task_date: string
    cleaner_id: string | null
    cleaner_name: string | null
    sort_order: number
    source: 'auto' | 'manual' | 'approved_patch'
    assignment_notes: string | null
    task_notes: string | null
    task_type: 'checkout_clean' | 'external_clean' | 'midstay_review'
  }>(
    `SELECT
        sa.id,
        sa.clean_task_id,
        ct.apartment_id,
        a.name AS apartment_name,
        a.building_id,
        sa.task_date,
        sa.cleaner_id,
        c.name AS cleaner_name,
        sa.sort_order,
        sa.source,
        sa.notes AS assignment_notes,
        ct.notes AS task_notes,
        ct.task_type
     FROM schedule_assignments sa
     JOIN clean_tasks ct ON ct.id = sa.clean_task_id
     LEFT JOIN apartments a ON a.id = ct.apartment_id
     LEFT JOIN cleaners c ON c.id = sa.cleaner_id
     WHERE sa.schedule_run_id = ?
     ORDER BY sa.task_date ASC, sa.sort_order ASC, apartment_name ASC`,
    [scheduleRunId],
  )

  return rows.map((row) => ({
    id: row.id,
    cleanTaskId: row.clean_task_id,
    apartmentId: row.apartment_id,
    apartmentName: row.apartment_name ?? row.task_notes ?? 'External clean',
    buildingId: row.building_id,
    taskDate: row.task_date,
    cleanerId: row.cleaner_id,
    cleanerName: row.cleaner_name,
    sortOrder: row.sort_order,
    source: row.source,
    notes: row.assignment_notes ?? row.task_notes,
    taskType: row.task_type,
  }))
}

export async function getManualReviewItems(
  weekStartIso: string,
): Promise<ManualReviewItem[]> {
  const weekEndIso = toIsoDate(addDays(parseISO(weekStartIso), 6))
  const rows = await all<{
    id: string
    apartment_name: string | null
    check_in: string
    check_out: string
    nights: number
    notes: string | null
  }>(
    `SELECT
       b.id,
       a.name AS apartment_name,
       b.check_in,
       b.check_out,
       b.nights,
       'Long stay flagged for manual review' AS notes
     FROM bookings b
     LEFT JOIN apartments a ON a.id = b.apartment_id
     WHERE b.nights > 7
       AND b.check_out BETWEEN ? AND ?`,
    [weekStartIso, weekEndIso],
  )

  return rows.map((row) => ({
    id: row.id,
    apartmentName: row.apartment_name ?? 'Unknown apartment',
    checkIn: row.check_in,
    checkOut: row.check_out,
    nights: row.nights,
    note: row.notes ?? 'Needs review',
  }))
}

export async function listChangeSets(scheduleRunId: string): Promise<ChangeSet[]> {
  const rows = await all<{
    id: string
    schedule_run_id: string
    source: 'ical' | 'chat'
    status: 'pending' | 'approved' | 'rejected'
    title: string
    summary: string
    payload_json: string
    created_at: string
  }>(
    `SELECT id, schedule_run_id, source, status, title, summary, payload_json, created_at
     FROM schedule_change_sets
     WHERE schedule_run_id = ?
     ORDER BY created_at DESC`,
    [scheduleRunId],
  )

  return rows.map((row) => ({
    id: row.id,
    scheduleRunId: row.schedule_run_id,
    source: row.source,
    status: row.status,
    title: row.title,
    summary: row.summary,
    payload: JSON.parse(row.payload_json) as ChangePayload,
    createdAt: row.created_at,
  }))
}

export async function getChangeSetById(changeSetId: string): Promise<ChangeSet | null> {
  const row = await first<{
    id: string
    schedule_run_id: string
    source: 'ical' | 'chat'
    status: 'pending' | 'approved' | 'rejected'
    title: string
    summary: string
    payload_json: string
    created_at: string
  }>(
    `SELECT id, schedule_run_id, source, status, title, summary, payload_json, created_at
     FROM schedule_change_sets
     WHERE id = ?`,
    [changeSetId],
  )

  if (!row) {
    return null
  }

  return {
    id: row.id,
    scheduleRunId: row.schedule_run_id,
    source: row.source,
    status: row.status,
    title: row.title,
    summary: row.summary,
    payload: JSON.parse(row.payload_json) as ChangePayload,
    createdAt: row.created_at,
  }
}

export async function latestSyncEvent(): Promise<SyncEvent | null> {
  const row = await first<{
    id: string
    sync_type: string
    status: string
    details_json: string
    created_at: string
  }>(
    `SELECT id, sync_type, status, details_json, created_at
     FROM sync_events
     ORDER BY created_at DESC
     LIMIT 1`,
  )

  if (!row) {
    return null
  }

  return {
    id: row.id,
    syncType: row.sync_type,
    status: row.status,
    details: JSON.parse(row.details_json) as Record<string, unknown>,
    createdAt: row.created_at,
  }
}

export async function createApartment(input: {
  name: string
  buildingId: string
  address: string
  icalUrl?: string | null
  isExternal?: boolean
  notes?: string | null
}) {
  const id = crypto.randomUUID()
  await run(
    `INSERT INTO apartments (id, name, building_id, address, ical_url, is_external, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      id,
      input.name,
      input.buildingId,
      input.address,
      input.icalUrl ?? null,
      input.isExternal ? 1 : 0,
      input.notes ?? null,
    ],
  )
  return id
}

export async function createCleaner(input: { name: string; colorHex?: string | null }) {
  const id = crypto.randomUUID()
  await run(
    `INSERT INTO cleaners (id, name, color_hex, is_active, updated_at)
     VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`,
    [id, input.name, input.colorHex ?? null],
  )
  return id
}

export async function createManualCleanRequest(input: {
  label: string
  apartmentId?: string | null
  taskDate?: string | null
  weekday?: number | null
  isRecurring?: boolean
  notes?: string | null
}) {
  const id = crypto.randomUUID()
  await run(
    `INSERT INTO manual_clean_requests
      (id, label, apartment_id, task_date, weekday, is_recurring, notes, is_active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
    [
      id,
      input.label,
      input.apartmentId ?? null,
      input.taskDate ?? null,
      input.weekday ?? null,
      input.isRecurring ? 1 : 0,
      input.notes ?? null,
    ],
  )
  return id
}

export async function savePushSubscription(subscription: {
  endpoint: string
  p256dh: string
  auth: string
}) {
  const existing = await first<{ id: string }>(
    `SELECT id FROM push_subscriptions WHERE endpoint = ?`,
    [subscription.endpoint],
  )

  if (existing) {
    await run(
      `UPDATE push_subscriptions
       SET p256dh = ?, auth = ?
       WHERE endpoint = ?`,
      [subscription.p256dh, subscription.auth, subscription.endpoint],
    )
    return existing.id
  }

  const id = crypto.randomUUID()
  await run(
    `INSERT INTO push_subscriptions (id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?)`,
    [id, subscription.endpoint, subscription.p256dh, subscription.auth],
  )
  return id
}

export async function listPushSubscriptions() {
  return all<{
    endpoint: string
    p256dh: string
    auth: string
  }>(
    `SELECT endpoint, p256dh, auth
     FROM push_subscriptions`,
  )
}

export async function removePushSubscription(endpoint: string) {
  await run(`DELETE FROM push_subscriptions WHERE endpoint = ?`, [endpoint])
}

export async function upsertBookings(apartmentId: string, bookings: Booking[]) {
  const statements: D1PreparedStatement[] = []
  const hashes = bookings.map((booking) => booking.rawHash)
  const windowStart = bookings.reduce<string | null>(
    (min, booking) => (min && min < booking.checkIn ? min : booking.checkIn),
    null,
  )

  for (const booking of bookings) {
    statements.push(
      db()
        .prepare(
          `INSERT INTO bookings
            (id, apartment_id, source, external_ref, guest_name, check_in, check_out, nights, raw_ical_uid, raw_hash, updated_at)
           VALUES (?, ?, 'ical', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(apartment_id, raw_hash) DO UPDATE SET
             external_ref = excluded.external_ref,
             guest_name = excluded.guest_name,
             check_in = excluded.check_in,
             check_out = excluded.check_out,
             nights = excluded.nights,
             raw_ical_uid = excluded.raw_ical_uid,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(
          booking.id,
          apartmentId,
          booking.externalRef,
          booking.guestName,
          booking.checkIn,
          booking.checkOut,
          booking.nights,
          booking.externalRef,
          booking.rawHash,
        ),
    )
  }

  if (windowStart) {
    const placeholders = hashes.map(() => '?').join(', ')
    const query =
      hashes.length > 0
        ? `DELETE FROM bookings WHERE apartment_id = ? AND check_out >= ? AND raw_hash NOT IN (${placeholders})`
        : `DELETE FROM bookings WHERE apartment_id = ? AND check_out >= ?`

    statements.push(db().prepare(query).bind(apartmentId, windowStart, ...hashes))
  }

  if (statements.length) {
    await db().batch(statements)
  }
}

export async function saveWeekPlan(input: {
  weekStart: string
  status: ScheduleStatus
  summary: string
  tasks: CleanTask[]
  assignments: ScheduleAssignment[]
}) {
  const existingRun = await getWeekRun(input.weekStart)
  const scheduleRunId = existingRun?.id ?? crypto.randomUUID()
  const weekEnd = toIsoDate(addDays(parseISO(input.weekStart), 6))

  const statements: D1PreparedStatement[] = [
    db()
      .prepare(
        `INSERT INTO schedule_runs (id, week_start, status, summary, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(week_start) DO UPDATE SET
           status = excluded.status,
           summary = excluded.summary,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(scheduleRunId, input.weekStart, input.status, input.summary),
    db()
      .prepare(
        `DELETE FROM schedule_assignments
         WHERE schedule_run_id = ?`,
      )
      .bind(scheduleRunId),
    db()
      .prepare(
        `DELETE FROM clean_tasks
         WHERE task_date BETWEEN ? AND ?`,
      )
      .bind(input.weekStart, weekEnd),
  ]

  for (const task of input.tasks) {
    statements.push(
      db()
        .prepare(
          `INSERT INTO clean_tasks
            (id, apartment_id, task_date, task_type, requires_review, notes, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        )
        .bind(
          task.id,
          task.apartmentId,
          task.taskDate,
          task.taskType,
          task.requiresReview ? 1 : 0,
          task.notes,
        ),
    )
  }

  for (const assignment of input.assignments) {
    statements.push(
      db()
        .prepare(
          `INSERT INTO schedule_assignments
            (id, schedule_run_id, clean_task_id, apartment_id, task_date, cleaner_id, sort_order, source, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          assignment.id,
          scheduleRunId,
          assignment.cleanTaskId,
          assignment.apartmentId,
          assignment.taskDate,
          assignment.cleanerId,
          assignment.sortOrder,
          assignment.source,
          assignment.notes,
        ),
    )
  }

  await db().batch(statements)

  return scheduleRunId
}

export async function createChangeSet(input: {
  scheduleRunId: string
  source: 'ical' | 'chat'
  title: string
  summary: string
  payload: ChangePayload
}) {
  const id = crypto.randomUUID()
  await run(
    `INSERT INTO schedule_change_sets
      (id, schedule_run_id, source, status, title, summary, payload_json)
     VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
    [
      id,
      input.scheduleRunId,
      input.source,
      input.title,
      input.summary,
      JSON.stringify(input.payload),
    ],
  )
  return id
}

export async function updateRunStatus(weekStart: string, status: ScheduleStatus, summary?: string) {
  await run(
    `UPDATE schedule_runs
     SET status = ?, summary = COALESCE(?, summary), updated_at = CURRENT_TIMESTAMP
     WHERE week_start = ?`,
    [status, summary ?? null, weekStart],
  )
}

export async function markChangeSet(changeSetId: string, status: 'approved' | 'rejected') {
  await run(
    `UPDATE schedule_change_sets
     SET status = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, changeSetId],
  )
}

export async function recordSyncEvent(
  syncType: string,
  status: string,
  details: Record<string, unknown>,
) {
  const id = crypto.randomUUID()
  await run(
    `INSERT INTO sync_events (id, sync_type, status, details_json)
     VALUES (?, ?, ?, ?)`,
    [id, syncType, status, JSON.stringify(details)],
  )
}
