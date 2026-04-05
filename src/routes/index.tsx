import { CalendarCheck2, RefreshCcw, Sparkles, Users } from 'lucide-react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { startTransition, useEffect, useState } from 'react'
import { AuthView } from '#/components/AuthView'
import { MobileAppShell } from '#/components/MobileAppShell'
import { PdfExportButton } from '#/components/PdfExportButton'
import { DayCard, ManualJobSheet, QuickEditSheet, WeekPanelHeader } from '#/components/WeekSections'
import { formatDayLabel, getTodayIsoInTimezone, isoInWeek, shiftWeek, weekDates } from '#/lib/date'
import { loadDashboard, postJson, weekSearchSchema } from '#/lib/dashboard-page'
import type { Cleaner, CleanerWeekAvailability, ScheduleAssignment } from '#/lib/types'

export const Route = createFileRoute('/')({
  validateSearch: weekSearchSchema,
  loaderDeps: ({ search }) => ({ weekStart: search.week }),
  loader: ({ deps }) => loadDashboard({ data: { weekStart: deps.weekStart } }),
  component: App,
})

function App() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
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
      badges.push('Changes waiting')
      priority = 0
      tone = 'changed'
    }

    if (reviewDates.has(group.date)) {
      badges.push('Review stay')
      priority = 0
      tone = 'changed'
    }

    if (isCurrentWeek && group.date < todayIso && group.rows.length > 0) {
      badges.push('Check this day')
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
  const nextStepLabel =
    pendingReviewCount > 0
      ? `Review ${pendingReviewCount} item${pendingReviewCount === 1 ? '' : 's'} before confirming the week`
      : data.weekStatus === 'confirmed'
        ? 'Week confirmed and ready to share with the team'
        : 'No blockers are waiting. Confirm the week once the plan looks right.'

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
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong')
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
            <h2 className="mt-2 text-xl font-semibold text-[var(--ink-strong)]">Keep the week calm and ready to run</h2>
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
                Review changes
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
                    : 'Confirm this week'}
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
              {busyKey === 'sync' ? 'Checking...' : 'Check for updates'}
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
                Review suggested changes and long stays before sharing the week.
              </p>
            </div>
            <span className="cleaner-chip">Open changes</span>
          </Link>
        ) : null}

        <article className="ledger-panel rounded-[1.75rem] p-4 panel-soft">
          <div className="section-head">
            <div>
              <p className="eyebrow">Team for this week</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">Cleaner availability</h2>
            </div>
            <p className="section-copy">
              Open the team sheet to choose who can be assigned in {data.weekLabel}.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {data.cleaners.length ? (
              data.cleaners.map((cleaner) => {
                const availabilityStatus =
                  data.weekCleanerAvailability.find((item) => item.cleanerId === cleaner.id)?.status ?? 'available'

                return (
                  <span
                    key={cleaner.id}
                    className={`cleaner-chip ${
                      availabilityStatus === 'off'
                        ? 'warning'
                        : availabilityStatus === 'partial'
                          ? 'subtle-chip'
                          : ''
                    }`}
                  >
                    <span
                      className="cleaner-dot"
                      style={{ backgroundColor: cleaner.colorHex ?? '#7ea8f8' }}
                      aria-hidden="true"
                    />
                    {cleaner.name}
                    {availabilityStatus === 'off'
                      ? 'off'
                      : availabilityStatus === 'partial'
                        ? 'partial'
                        : 'on'}
                  </span>
                )
              })
            ) : (
              <p className="text-sm leading-6 text-[var(--ink-soft)]">
                Add cleaners first, then open the team sheet for this week.
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
              {availabilityBusy ? 'Saving...' : 'Open team sheet'}
            </button>
          </div>
        </article>

        <CleanerAvailabilitySheet
          open={availabilityOpen}
          cleaners={data.cleaners}
          weekCleanerAvailability={data.weekCleanerAvailability}
          weekLabel={data.weekLabel}
          busyKey={busyKey}
          successMessage={availabilitySuccess}
          onClose={() => {
            if (availabilityBusy) {
              return
            }

            setAvailabilityOpen(false)
          }}
          onSetAvailability={(cleanerId, isAvailable) => {
            const cleaner = data.cleaners.find((item) => item.id === cleanerId)
            const cleanerName = cleaner?.name ?? 'Cleaner'

            void runAction(
              `availability-${isAvailable ? 'on' : 'off'}-${cleanerId}`,
              async () => {
                await postJson('/api/setup/cleaners/availability', {
                  weekStart: data.weekStart,
                  cleanerId,
                  isAvailable,
                })
              },
              () => {
                setAvailabilitySuccess(
                  isAvailable
                    ? `${cleanerName} is available for ${data.weekLabel}.`
                    : `${cleanerName} will be left out of ${data.weekLabel}.`,
                )
              },
            )
          }}
        />
        <article className="ledger-panel rounded-[1.75rem] p-4 panel-feature">
          <div className="section-head">
            <div>
              <p className="eyebrow">Needs attention first</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">
                Weekly plan
              </h2>
            </div>
            <p className="section-copy">
              Overdue days, changed days, and today are shown before the rest of the week.
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
            <summary>Quiet days</summary>
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
          editingAssignment?.sourceManualRequestId ? 'Delete this extra clean' : 'Remove from this week'
        }
        deleteHint={
          editingAssignment?.sourceManualRequestId
            ? 'This extra clean was added by hand and will be removed from the plan.'
            : 'This will remove the clean from the week you are viewing. A future booking refresh can add checkout cleans back.'
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
  weekCleanerAvailability,
  weekLabel,
  busyKey,
  successMessage,
  onClose,
  onSetAvailability,
}: {
  open: boolean
  cleaners: Cleaner[]
  weekCleanerAvailability: CleanerWeekAvailability[]
  weekLabel: string
  busyKey: string | null
  successMessage: string | null
  onClose: () => void
  onSetAvailability: (cleanerId: string, isAvailable: boolean) => void
}) {
  if (!open) {
    return null
  }

  const availabilityByCleanerId = new Map(
    weekCleanerAvailability.map((item) => [item.cleanerId, item.status]),
  )

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Cleaner availability">
      <div className="sheet-panel sheet-panel-feature">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Week-by-week team</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">Cleaner availability</h2>
          </div>
          <button type="button" className="action-ghost sheet-close-button" onClick={onClose} disabled={Boolean(busyKey?.startsWith('availability-'))}>
            Close
          </button>
        </div>

        <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
          Choose who can be assigned in {weekLabel}. This only changes the week you are viewing.
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
              const availableKey = `availability-on-${cleaner.id}`
              const offKey = `availability-off-${cleaner.id}`
              const isSavingAvailable = busyKey === availableKey
              const isSavingOff = busyKey === offKey
              const isSaving = isSavingAvailable || isSavingOff

              return (
                <article
                  key={cleaner.id}
                  className={`home-card availability-card ${
                    availabilityStatus === 'off'
                      ? 'is-off'
                      : availabilityStatus === 'partial'
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
                      {availabilityStatus === 'partial' ? (
                        <span className="cleaner-chip subtle-chip">Partly unavailable</span>
                      ) : null}
                    </div>
                    <p className="availability-summary">
                      {availabilityStatus === 'off'
                        ? 'This cleaner will not be used for any day in the selected week.'
                        : availabilityStatus === 'partial'
                          ? 'Some days are blocked. Pick one option below to set the whole week.'
                          : 'This cleaner can be assigned anywhere in the selected week.'}
                    </p>
                  </div>

                  <div className="availability-actions">
                    <button
                      type="button"
                      className={`availability-toggle ${availabilityStatus === 'available' ? 'is-active' : ''}`}
                      disabled={isSaving}
                      onClick={() => {
                        if (availabilityStatus === 'available') {
                          return
                        }

                        onSetAvailability(cleaner.id, true)
                      }}
                    >
                      {isSavingAvailable ? 'Saving...' : 'Use this week'}
                    </button>
                    <button
                      type="button"
                      className={`availability-toggle ${availabilityStatus === 'off' ? 'is-active' : ''}`}
                      disabled={isSaving}
                      onClick={() => {
                        if (availabilityStatus === 'off') {
                          return
                        }

                        onSetAvailability(cleaner.id, false)
                      }}
                    >
                      {isSavingOff ? 'Saving...' : 'Leave out'}
                    </button>
                  </div>
                </article>
              )
            })
          ) : (
            <p className="text-sm leading-6 text-[var(--ink-soft)]">
              Add a cleaner first, then choose who is available for {weekLabel}.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
