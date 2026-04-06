import { CalendarCheck2, RefreshCcw, Sparkles, Users } from 'lucide-react'
import { Link, getRouteApi, useRouter } from '@tanstack/react-router'
import { startTransition, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { AuthView } from '#/components/AuthView'
import { MobileAppShell } from '#/components/MobileAppShell'
import { PdfExportButton } from '#/components/PdfExportButton'
import { DayCard, ManualJobSheet, QuickEditSheet, WeekPanelHeader } from '#/components/WeekSections'
import { formatDayLabel, getTodayIsoInTimezone, isoInWeek, shiftWeek, weekDates } from '#/lib/date'
import { postJson } from '#/lib/dashboard-page'
import type { Cleaner, CleanerAvailability, CleanerWeekAvailability, ScheduleAssignment } from '#/lib/types'

const plannerRoute = getRouteApi('/_planner')

export function WeekPage() {
  const data = plannerRoute.useLoaderData()
  const search = plannerRoute.useSearch()
  const router = useRouter()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [editingAssignment, setEditingAssignment] = useState<ScheduleAssignment | null>(null)
  const [manualJobDate, setManualJobDate] = useState('')
  const [manualJobOpen, setManualJobOpen] = useState(false)
  const [manualJobApartmentId, setManualJobApartmentId] = useState('')
  const [availabilityOpen, setAvailabilityOpen] = useState(false)
  const [manualJobSuccess, setManualJobSuccess] = useState<string | null>(null)
  const [availabilitySuccess, setAvailabilitySuccess] = useState<string | null>(null)
  const [editCleanerId, setEditCleanerId] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editTaskDate, setEditTaskDate] = useState('')

  const todayIso = getTodayIsoInTimezone()
  const isCurrentWeek = isoInWeek(todayIso, data.weekStart)
  const changedDates = new Set(
    data.changeSets.flatMap((changeSet) => changeSet.payload.changes.map((change) => change.date)),
  )
  const reviewDates = new Set(data.manualReviews.map((item) => item.checkOut))

  const annotatedGroups = data.dayGroups.map((group) => {
    const badges: string[] = []
    let priority = 4
    let tone: 'default' | 'attention' | 'changed' = 'default'

    if (changedDates.has(group.date)) {
      badges.push('Review changes')
      priority = 0
      tone = 'changed'
    }

    if (reviewDates.has(group.date)) {
      badges.push('Check long stay')
      priority = 0
      tone = 'changed'
    }

    if (isCurrentWeek && group.date < todayIso && group.rows.length > 0) {
      badges.push('Past due')
      priority = Math.min(priority, 1)
      tone = tone === 'changed' ? 'changed' : 'attention'
    }

    if (group.date === todayIso) {
      priority = Math.min(priority, 2)
    }

    if (group.date > todayIso && group.rows.length > 0) {
      priority = Math.min(priority, 3)
    }

    if (group.rows.length === 0 && badges.length === 0) {
      priority = 5
    }

    return {
      group,
      badges,
      priority,
      tone,
    }
  })

  const activeGroups = annotatedGroups
    .filter((item) => item.group.rows.length > 0 || item.badges.length > 0)
    .sort((left, right) => {
      if (!isCurrentWeek) {
        return left.group.date.localeCompare(right.group.date)
      }

      if (left.priority === right.priority) {
        return left.group.date.localeCompare(right.group.date)
      }

      return left.priority - right.priority
    })

  const emptyGroups = annotatedGroups.filter(
    (item) => item.group.rows.length === 0 && item.badges.length === 0,
  )
  const availableDates = annotatedGroups.map((item) => item.group.date)
  const availableDatesKey = availableDates.join('|')
  const cleansLeft = activeGroups.reduce((total, item) => total + item.group.rows.length, 0)
  const defaultOpenDay = activeGroups.find((item) => !item.group.isEmpty)?.group.date ?? data.weekStart
  const availabilityBusy = Boolean(busyKey?.startsWith('availability-'))
  const pendingReviewCount = data.changeSets.length + data.manualReviews.length
  const availabilityWeekLabel = formatWeekLabelWithoutYear(data.weekStart)
  const nextStepLabel =
    pendingReviewCount > 0
      ? `Review ${pendingReviewCount} item${pendingReviewCount === 1 ? '' : 's'} before you confirm the week`
      : data.weekStatus === 'confirmed'
        ? 'Week confirmed and ready to share with the team.'
        : 'Everything looks good. Confirm the week when you are ready.'

  useEffect(() => {
    setOpenDay((current) => {
      if (current && availableDates.includes(current)) {
        return current
      }

      return defaultOpenDay
    })
  }, [availableDatesKey, defaultOpenDay])

  useEffect(() => {
    if (!editingAssignment) {
      return
    }

    setEditCleanerId(editingAssignment.cleanerId ?? '')
    setEditNotes(editingAssignment.notes ?? '')
    setEditTaskDate(editingAssignment.taskDate)
  }, [editingAssignment])

  async function refresh() {
    await router.invalidate({ sync: true })
  }

  async function runAction(key: string, action: () => Promise<void>, onSuccess?: () => void) {
    setBusyKey(key)
    setError(null)

    try {
      await action()
      await refresh()
      onSuccess?.()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong. Please try again.')
    } finally {
      setBusyKey(null)
    }
  }

  function moveWeek(direction: -1 | 1) {
    startTransition(() => {
      void router.navigate({
        to: '/',
        search: () => ({
          week: shiftWeek(data.weekStart, direction),
        }),
      })
    })
  }

  function jumpToCurrentWeek() {
    startTransition(() => {
      void router.navigate({
        to: '/',
        search: () => ({}),
      })
    })
  }

  if (!data.authenticated) {
    return (
      <AuthView
        busy={busyKey === 'login'}
        error={error}
        onSubmit={(password) => {
          void runAction('login', async () => {
            await postJson('/api/auth/login', { password })
          })
        }}
      />
    )
  }

  return (
    <MobileAppShell
      activeTab="week"
      weekStart={data.weekStart}
      pendingReviewCount={pendingReviewCount}
      onSwipeLeft={() => moveWeek(1)}
      onSwipeRight={() => moveWeek(-1)}
      floatingAction={
        <PdfExportButton
          weekLabel={data.weekLabel}
          weekStatus={data.weekStatus}
          dayGroups={data.dayGroups}
          variant="fab"
        />
      }
    >
      <div className="route-stage route-stage-week">
        <WeekPanelHeader
          title={data.weekLabel}
          status={data.weekStatus}
          showThisWeekButton={Boolean(search.week)}
          onPrevious={() => moveWeek(-1)}
          onCurrent={jumpToCurrentWeek}
          onNext={() => moveWeek(1)}
        >
          <article className="overview-card overview-card-week">
            <div className="overview-copy">
              <p className="eyebrow">This week at a glance</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--ink-strong)]">Everything set for a smooth week</h2>
              <div className="overview-metrics">
                <span className="overview-metric">
                  <strong>{cleansLeft}</strong>
                  {cleansLeft === 1 ? 'clean' : 'cleans'}
                </span>
                <span className={`overview-metric ${pendingReviewCount > 0 ? 'is-urgent' : ''}`}>
                  <strong>{pendingReviewCount}</strong>
                  {pendingReviewCount === 1 ? 'item to review' : 'items to review'}
                </span>
                <span className="overview-metric">
                  <strong>{data.cleaners.length}</strong>
                  {data.cleaners.length === 1 ? 'cleaner' : 'cleaners'}
                </span>
              </div>
              <div className={`overview-next-step ${pendingReviewCount > 0 ? 'is-urgent' : ''}`}>
                <span className="overview-next-step-label">Next step</span>
                <p>{nextStepLabel}</p>
              </div>
            </div>

            <div className="overview-actions overview-actions-priority">
              {pendingReviewCount > 0 ? (
                <Link to="/review" search={{ week: data.weekStart }} className="action-primary no-underline">
                  <Sparkles size={16} />
                  Review updates
                </Link>
              ) : (
                <button
                  type="button"
                  className="action-primary"
                  disabled={busyKey === 'confirm' || data.weekStatus === 'confirmed'}
                  onClick={() =>
                    runAction('confirm', async () => {
                      await postJson('/api/schedule/confirm', { weekStart: data.weekStart })
                    })
                  }
                >
                  <CalendarCheck2 size={16} />
                  {data.weekStatus === 'confirmed'
                    ? 'Week confirmed'
                    : busyKey === 'confirm'
                      ? 'Saving...'
                      : 'Confirm week'}
                </button>
              )}
              <button
                type="button"
                className="action-secondary"
                disabled={busyKey === 'sync'}
                onClick={() =>
                  runAction('sync', async () => {
                    await postJson('/api/system/run-sync', { weekStart: data.weekStart })
                  })
                }
              >
                <RefreshCcw size={16} />
                {busyKey === 'sync' ? 'Refreshing...' : 'Refresh bookings'}
              </button>
            </div>
          </article>
        </WeekPanelHeader>

        {error ? (
          <section className="error-banner">
            {error}
          </section>
        ) : null}

        <section className="content-stack route-stack route-stack-week">
          {data.changeSets.length || data.manualReviews.length ? (
            <Link to="/review" search={{ week: data.weekStart }} className="review-callout review-callout-week no-underline">
              <div>
                <p className="eyebrow">Needs your attention</p>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  Review updates and long stays before you share this week.
                </p>
              </div>
              <span className="cleaner-chip">Open review</span>
            </Link>
          ) : null}

          <article className="ledger-panel rounded-[1.75rem] p-4 panel-soft">
            <div className="section-head">
              <div>
                <p className="eyebrow">Team for this week</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">Cleaner availability</h2>
              </div>
              <p className="section-copy">
                Choose who is available in {availabilityWeekLabel}.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {data.cleaners.length ? (
                data.cleaners.map((cleaner) => {
                  const availabilityStatus =
                    data.weekCleanerAvailability.find((item) => item.cleanerId === cleaner.id)?.status ?? 'available'
                  const availabilityMeta = getAvailabilityPresentation(availabilityStatus)

                  return (
                    <span
                      key={cleaner.id}
                      className={`cleaner-chip cleaner-chip-availability cleaner-chip-${availabilityMeta.tone}`}
                      title={availabilityMeta.tooltip}
                    >
                      <span
                        className="cleaner-dot"
                        style={{ backgroundColor: cleaner.colorHex ?? '#7ea8f8' }}
                        aria-hidden="true"
                      />
                      {cleaner.name}
                      <span
                        className={`availability-inline-status availability-inline-status-${availabilityMeta.tone}`}
                      >
                        {availabilityMeta.shortLabel}
                      </span>
                    </span>
                  )
                })
              ) : (
                <p className="text-sm leading-6 text-[var(--ink-soft)]">
                  Add at least one cleaner to set weekly availability.
                </p>
              )}
            </div>

            <div className="mt-4">
              <button
                type="button"
                className="action-secondary"
                disabled={availabilityBusy}
                onClick={() => {
                  setAvailabilitySuccess(null)
                  setAvailabilityOpen(true)
                }}
              >
                <Users size={16} />
                {availabilityBusy ? 'Saving...' : 'Team availability'}
              </button>
            </div>
          </article>

          <CleanerAvailabilitySheet
            open={availabilityOpen}
            cleaners={data.cleaners}
            weekStart={data.weekStart}
            weekAvailability={data.weekAvailability}
            weekCleanerAvailability={data.weekCleanerAvailability}
            weekLabel={availabilityWeekLabel}
            busyKey={busyKey}
            successMessage={availabilitySuccess}
            onClose={() => {
              if (availabilityBusy) {
                return
              }

              setAvailabilityOpen(false)
            }}
            onSetAvailability={(cleanerId, isAvailable, date) => {
              const cleaner = data.cleaners.find((item) => item.id === cleanerId)
              const cleanerName = cleaner?.name ?? 'Cleaner'
              const dayLabel = date ? formatDayLabel(date) : null

              void runAction(
                `availability-${isAvailable ? 'on' : 'off'}-${cleanerId}-${date ?? 'week'}`,
                async () => {
                  await postJson('/api/setup/cleaners/availability', {
                    weekStart: data.weekStart,
                    cleanerId,
                    isAvailable,
                    date,
                  })
                },
                () => {
                  if (dayLabel) {
                    setAvailabilitySuccess(
                      isAvailable
                        ? `${cleanerName} is set as available on ${dayLabel}.`
                        : `${cleanerName} is marked off on ${dayLabel}.`,
                    )
                    return
                  }

                  setAvailabilitySuccess(
                    isAvailable
                      ? `${cleanerName} is available for all of ${data.weekLabel}.`
                      : `${cleanerName} is marked off for ${data.weekLabel}.`,
                  )
                },
              )
            }}
          />
          <article className="ledger-panel rounded-[1.75rem] p-4 panel-feature">
            <div className="section-head">
              <div>
                <p className="eyebrow">What to handle first</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">
                  Weekly plan
                </h2>
              </div>
              <p className="section-copy">
                Past-due days, changed days, and today are shown first.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {activeGroups.map(({ group, badges, tone }) => (
                <DayCard
                  key={group.date}
                  group={group}
                  open={openDay === group.date}
                  isToday={group.date === todayIso}
                  badges={badges}
                  tone={tone}
                  onToggle={() => setOpenDay(openDay === group.date ? null : group.date)}
                  onRowSelect={(row) => setEditingAssignment(row)}
                  onAddJob={(date) => {
                    setManualJobDate(date)
                    setManualJobSuccess(null)
                    setManualJobOpen(true)
                  }}
                />
              ))}
            </div>
          </article>

          {emptyGroups.length ? (
            <details className="fold-panel">
              <summary className="fold-panel-summary">
                <span className="fold-panel-heading">
                  <span className="fold-panel-heading-copy">
                    <span className="eyebrow">No cleans booked</span>
                    <span className="fold-panel-title">Quiet days</span>
                  </span>
                  <span className="fold-panel-heading-meta">
                    <span className="fold-panel-count">{emptyGroups.length}</span>
                    <span className="fold-panel-chevron" aria-hidden="true" />
                  </span>
                </span>
              </summary>
              <div className="mt-4 space-y-3">
                {emptyGroups.map(({ group }) => (
                  <DayCard
                    key={group.date}
                    group={group}
                    open={openDay === group.date}
                    onToggle={() => setOpenDay(openDay === group.date ? null : group.date)}
                    onAddJob={(date) => {
                      setManualJobDate(date)
                      setManualJobSuccess(null)
                      setManualJobOpen(true)
                    }}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </section>

        <QuickEditSheet
          open={Boolean(editingAssignment)}
          title={editingAssignment ? `${editingAssignment.apartmentName} · ${formatDayLabel(editingAssignment.taskDate)}` : ''}
          deleteLabel={
            editingAssignment?.sourceManualRequestId ? 'Delete extra clean' : 'Remove clean from this week'
          }
          deleteHint={
            editingAssignment?.sourceManualRequestId
              ? 'This extra clean will be removed from the weekly plan.'
              : 'This clean will be removed from this week.'
          }
          cleanerId={editCleanerId}
          notes={editNotes}
          taskDate={editTaskDate}
          bookingUrl={editingAssignment?.bookingUrl ?? null}
          cleaners={data.cleaners}
          dateOptions={weekDates(data.weekStart)}
          saving={busyKey === 'quick-edit'}
          deleting={busyKey === 'delete-job'}
          onClose={() => setEditingAssignment(null)}
          onCleanerChange={setEditCleanerId}
          onNotesChange={setEditNotes}
          onTaskDateChange={setEditTaskDate}
          onSave={() => {
            if (!editingAssignment) {
              return
            }

            void runAction('quick-edit', async () => {
              await postJson('/api/schedule/manual-edit', {
                weekStart: data.weekStart,
                assignmentId: editingAssignment.id,
                cleanerId: editCleanerId || null,
                notes: editNotes,
                taskDate: editTaskDate,
              })
              setEditingAssignment(null)
            })
          }}
          onDelete={() => {
            if (!editingAssignment) {
              return
            }

            void runAction('delete-job', async () => {
              await postJson('/api/schedule/delete-assignment', {
                weekStart: data.weekStart,
                assignmentId: editingAssignment.id,
              })
              setEditingAssignment(null)
            })
          }}
        />

        <ManualJobSheet
          open={manualJobOpen}
          dayLabel={manualJobDate ? formatDayLabel(manualJobDate) : ''}
          apartments={data.apartments}
          apartmentId={manualJobApartmentId}
          busy={busyKey === 'add-manual'}
          onApartmentChange={(value) => {
            setManualJobApartmentId(value)
            if (manualJobSuccess) {
              setManualJobSuccess(null)
            }
          }}
          onClose={() => {
            if (busyKey === 'add-manual') {
              return
            }

            setManualJobOpen(false)
            setManualJobSuccess(null)
          }}
          onSubmit={() => {
            const selectedApartment = data.apartments.find((apartment) => apartment.id === manualJobApartmentId)
            const apartmentName = selectedApartment?.colloquialName ?? selectedApartment?.name ?? 'the selected home'

            void runAction(
              'add-manual',
              async () => {
                await postJson('/api/setup/manual-cleans', {
                  taskDate: manualJobDate,
                  apartmentId: manualJobApartmentId || undefined,
                  isRecurring: false,
                  weekStart: data.weekStart,
                })
              },
              () => {
                setManualJobApartmentId('')
                setManualJobSuccess(`Added a clean for ${apartmentName} on ${formatDayLabel(manualJobDate)}.`)
              },
            )
          }}
          successMessage={manualJobSuccess}
        />
      </div>
    </MobileAppShell>
  )
}

function CleanerAvailabilitySheet({
  open,
  cleaners,
  weekStart,
  weekAvailability,
  weekCleanerAvailability,
  weekLabel,
  busyKey,
  successMessage,
  onClose,
  onSetAvailability,
}: {
  open: boolean
  cleaners: Cleaner[]
  weekStart: string
  weekAvailability: CleanerAvailability[]
  weekCleanerAvailability: CleanerWeekAvailability[]
  weekLabel: string
  busyKey: string | null
  successMessage: string | null
  onClose: () => void
  onSetAvailability: (cleanerId: string, isAvailable: boolean, date?: string) => void
}) {
  if (!open) {
    return null
  }

  const weekDateList = weekDates(weekStart)
  const availabilityBusy = Boolean(busyKey?.startsWith('availability-'))
  const availabilityByCleanerId = new Map(
    weekCleanerAvailability.map((item) => [item.cleanerId, item.status]),
  )
  const offDatesByCleanerId = new Map<string, Set<string>>()

  for (const entry of weekAvailability) {
    if (entry.status !== 'off') {
      continue
    }

    const offDateSet = offDatesByCleanerId.get(entry.cleanerId) ?? new Set<string>()
    offDateSet.add(entry.date)
    offDatesByCleanerId.set(entry.cleanerId, offDateSet)
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Team availability">
      <div className="sheet-panel sheet-panel-feature">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Team schedule</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">Availability</h2>
          </div>
          <button type="button" className="action-ghost sheet-close-button" onClick={onClose} disabled={availabilityBusy}>
            Close
          </button>
        </div>

        <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
          Set who can take cleans in {weekLabel}.
        </p>
        {successMessage ? (
          <section className="inline-feedback inline-feedback-success" role="status" aria-live="polite">
            {successMessage}
          </section>
        ) : null}

        <div className="mt-5 space-y-3">
          {cleaners.length ? (
            cleaners.map((cleaner) => {
              const availabilityStatus = availabilityByCleanerId.get(cleaner.id) ?? 'available'
              const availabilityMeta = getAvailabilityPresentation(availabilityStatus)
              const availableKey = `availability-on-${cleaner.id}-week`
              const offKey = `availability-off-${cleaner.id}-week`
              const isSavingAvailable = busyKey === availableKey
              const isSavingOff = busyKey === offKey
              const offDates = offDatesByCleanerId.get(cleaner.id) ?? new Set<string>()

              return (
                <article
                  key={cleaner.id}
                  className={`home-card availability-card ${
                    availabilityMeta.tone === 'off'
                      ? 'is-off'
                      : availabilityMeta.tone === 'partial'
                        ? 'is-partial'
                        : ''
                  }`}
                >
                  <div className="availability-copy">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="cleaner-chip">
                        <span
                          className="cleaner-dot"
                          style={{ backgroundColor: cleaner.colorHex ?? '#7ea8f8' }}
                          aria-hidden="true"
                        />
                        {cleaner.name}
                      </span>
                      <span
                        className={`availability-inline-status availability-inline-status-${availabilityMeta.tone}`}
                        title={availabilityMeta.tooltip}
                      >
                        {availabilityMeta.shortLabel}
                      </span>
                    </div>
                    <p className="availability-summary">{availabilityMeta.summary}</p>
                    <div className="availability-day-grid" role="group" aria-label={`${cleaner.name} availability by day`}>
                      {weekDateList.map((dateIso) => {
                        const isAvailableForDay = !offDates.has(dateIso)
                        const dayBusyKey = `availability-${isAvailableForDay ? 'off' : 'on'}-${cleaner.id}-${dateIso}`
                        const isSavingDay = busyKey === dayBusyKey

                        return (
                          <button
                            key={dateIso}
                            type="button"
                            className={`availability-day-toggle ${isAvailableForDay ? 'is-on' : 'is-off'}`}
                            disabled={availabilityBusy}
                            aria-pressed={!isAvailableForDay}
                            title={`${cleaner.name}: ${isAvailableForDay ? 'available' : 'off'} on ${formatDayLabel(dateIso)}`}
                            onClick={() => {
                              onSetAvailability(cleaner.id, !isAvailableForDay, dateIso)
                            }}
                          >
                            <span className="availability-day-name">{format(parseISO(dateIso), 'EEE')}</span>
                            <span className="availability-day-date">{format(parseISO(dateIso), 'd MMM')}</span>
                            <span className="availability-day-state">
                              {isSavingDay ? '...' : isAvailableForDay ? 'On' : 'Off'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="availability-actions">
                    <button
                      type="button"
                      className={`availability-toggle ${availabilityStatus === 'available' ? 'is-active is-active-on' : ''}`}
                      disabled={availabilityBusy}
                      onClick={() => {
                        if (availabilityStatus === 'available') {
                          return
                        }

                        onSetAvailability(cleaner.id, true)
                      }}
                    >
                      {isSavingAvailable ? 'Saving...' : 'Available all week'}
                    </button>
                    <button
                      type="button"
                      className={`availability-toggle ${availabilityStatus === 'off' ? 'is-active is-active-off' : ''}`}
                      disabled={availabilityBusy}
                      onClick={() => {
                        if (availabilityStatus === 'off') {
                          return
                        }

                        onSetAvailability(cleaner.id, false)
                      }}
                    >
                      {isSavingOff ? 'Saving...' : 'Off all week'}
                    </button>
                  </div>
                </article>
              )
            })
          ) : (
            <p className="text-sm leading-6 text-[var(--ink-soft)]">
              Add a cleaner to start setting availability for {weekLabel}.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function formatWeekLabelWithoutYear(weekStartIso: string) {
  const [startIso, ...rest] = weekDates(weekStartIso)
  const endIso = rest.length ? rest[rest.length - 1] : startIso
  return `${format(parseISO(startIso), 'd MMM')} - ${format(parseISO(endIso), 'd MMM')}`
}

function getAvailabilityPresentation(status: CleanerWeekAvailability['status']) {
  if (status === 'off') {
    return {
      tone: 'off' as const,
      shortLabel: 'Off all week',
      summary: 'Not scheduled this week.',
      tooltip: 'Off all week',
    }
  }

  if (status === 'partial') {
    return {
      tone: 'partial' as const,
      shortLabel: 'Partial week',
      summary: 'Available on some days this week.',
      tooltip: 'Partial week availability',
    }
  }

  return {
    tone: 'on' as const,
    shortLabel: 'Available all week',
    summary: 'Available every day this week.',
    tooltip: 'Available all week',
  }
}
