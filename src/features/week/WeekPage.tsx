import { CalendarCheck2, Sparkles } from 'lucide-react'
import { Link, getRouteApi, useRouter } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { startTransition, useEffect, useMemo, useState } from 'react'
import { MobileAppShell } from '#/components/MobileAppShell'
import { PdfExportButton } from '#/components/PdfExportButton'
import { PlannerHeader } from '#/components/planner'
import { formatDayLabel, shiftWeek, weekDates } from '#/lib/date'
import { postJson } from '#/lib/dashboard-page'
import { dashboardQueryOptions, useDashboardActionMutation } from '#/lib/dashboard-query'
import { plannerNavOptions } from '#/lib/planner-navigation'
import type { DashboardData, ScheduleAssignment } from '#/lib/types'
import { CleanerAvailabilitySheet } from './components/CleanerAvailabilitySheet'
import { ManualJobSheet } from './components/ManualJobSheet'
import { QuickEditSheet } from './components/QuickEditSheet'
import { TeamAvailabilityCard } from './components/TeamAvailabilityCard'
import { WeekOverviewCard } from './components/WeekOverviewCard'
import { WeeklyPlanPanel } from './components/WeeklyPlanPanel'
import { buildWeekPageModel } from './week-model'

const plannerRoute = getRouteApi('/_planner')

function updateWeekAvailabilityOptimistically(
  current: DashboardData,
  input: { cleanerId: string; isAvailable: boolean; date?: string },
) {
  const weekDateList = weekDates(current.weekStart)
  const weekDateSet = new Set(weekDateList)
  const availabilityByCleanerDate = new Map<string, DashboardData['weekAvailability'][number]>()

  for (const entry of current.weekAvailability) {
    if (entry.status !== 'off' || !weekDateSet.has(entry.date)) {
      continue
    }

    availabilityByCleanerDate.set(`${entry.cleanerId}:${entry.date}`, entry)
  }

  if (input.date) {
    const entryKey = `${input.cleanerId}:${input.date}`

    if (input.isAvailable) {
      availabilityByCleanerDate.delete(entryKey)
    } else {
      availabilityByCleanerDate.set(entryKey, {
        cleanerId: input.cleanerId,
        date: input.date,
        status: 'off',
      })
    }
  } else if (input.isAvailable) {
    for (const dateIso of weekDateList) {
      availabilityByCleanerDate.delete(`${input.cleanerId}:${dateIso}`)
    }
  } else {
    for (const dateIso of weekDateList) {
      availabilityByCleanerDate.set(`${input.cleanerId}:${dateIso}`, {
        cleanerId: input.cleanerId,
        date: dateIso,
        status: 'off',
      })
    }
  }

  const nextWeekAvailability = Array.from(availabilityByCleanerDate.values()).sort((left, right) => {
    if (left.cleanerId === right.cleanerId) {
      return left.date.localeCompare(right.date)
    }

    return left.cleanerId.localeCompare(right.cleanerId)
  })

  const offDayCountByCleaner = new Map<string, number>()
  for (const entry of nextWeekAvailability) {
    offDayCountByCleaner.set(entry.cleanerId, (offDayCountByCleaner.get(entry.cleanerId) ?? 0) + 1)
  }

  const nextWeekCleanerAvailability = current.cleaners.map((cleaner) => {
    const offDayCount = offDayCountByCleaner.get(cleaner.id) ?? 0

    if (offDayCount === 0) {
      return {
        cleanerId: cleaner.id,
        status: 'available' as const,
      }
    }

    if (offDayCount >= weekDateList.length) {
      return {
        cleanerId: cleaner.id,
        status: 'off' as const,
      }
    }

    return {
      cleanerId: cleaner.id,
      status: 'partial' as const,
    }
  })

  return {
    ...current,
    weekAvailability: nextWeekAvailability,
    weekCleanerAvailability: nextWeekCleanerAvailability,
  }
}

export function WeekPage() {
  const search = plannerRoute.useSearch()
  const { data } = useSuspenseQuery(dashboardQueryOptions(search.week))
  const router = useRouter()
  const actionMutation = useDashboardActionMutation(search.week)
  const navOptions = plannerNavOptions(data.weekStart)
  const weekModel = useMemo(() => buildWeekPageModel(data), [data])
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

  const {
    activeGroups,
    emptyGroups,
    availableDates,
    defaultOpenDay,
    cleansLeft,
    pendingReviewCount,
    availabilityWeekLabel,
    nextStepLabel,
    todayIso,
  } = weekModel
  const availableDatesKey = availableDates.join('|')
  const availabilityBusy = Boolean(busyKey?.startsWith('availability-'))

  useEffect(() => {
    setOpenDay((current) => {
      if (current && availableDates.includes(current)) {
        return current
      }

      return defaultOpenDay
    })
  }, [availableDates, availableDatesKey, defaultOpenDay])

  useEffect(() => {
    if (!editingAssignment) {
      return
    }

    setEditCleanerId(editingAssignment.cleanerId ?? '')
    setEditNotes(editingAssignment.notes ?? '')
    setEditTaskDate(editingAssignment.taskDate)
  }, [editingAssignment])

  async function runAction(
    key: string,
    action: () => Promise<void>,
    onSuccess?: () => void,
    optimisticUpdate?: (current: DashboardData) => DashboardData,
  ) {
    setBusyKey(key)
    setError(null)

    try {
      await actionMutation.mutateAsync(
        optimisticUpdate
          ? {
              action,
              optimisticUpdate,
            }
          : action,
      )
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
        search: (prev) => ({
          ...prev,
          week: shiftWeek(data.weekStart, direction),
        }),
      })
    })
  }

  function jumpToCurrentWeek() {
    startTransition(() => {
      void router.navigate({
        to: '/',
        search: (prev) => ({
          ...prev,
          week: undefined,
        }),
      })
    })
  }

  function toggleDay(date: string) {
    setOpenDay((current) => (current === date ? null : date))
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
        <PlannerHeader
          title={data.weekLabel}
          status={data.weekStatus}
          showThisWeekButton={Boolean(search.week)}
          onPrevious={() => moveWeek(-1)}
          onCurrent={jumpToCurrentWeek}
          onNext={() => moveWeek(1)}
        >
          <WeekOverviewCard
            cleansLeft={cleansLeft}
            pendingReviewCount={pendingReviewCount}
            cleanerCount={data.cleaners.length}
            nextStepLabel={nextStepLabel}
            primaryAction={
              pendingReviewCount > 0 ? (
                <Link {...navOptions.changes} className="action-primary no-underline">
                  <Sparkles size={16} />
                  Review updates
                </Link>
              ) : (
                <button
                  type="button"
                  className="action-primary"
                  disabled={busyKey === 'confirm' || data.weekStatus === 'confirmed'}
                  onClick={() => {
                    void runAction(
                      'confirm',
                      async () => {
                        await postJson('/api/schedule/confirm', { weekStart: data.weekStart })
                      },
                      undefined,
                      (current) => ({
                        ...current,
                        weekStatus: 'confirmed',
                      }),
                    )
                  }}
                >
                  <CalendarCheck2 size={16} />
                  {data.weekStatus === 'confirmed'
                    ? 'Week confirmed'
                    : busyKey === 'confirm'
                      ? 'Saving...'
                      : 'Confirm week'}
                </button>
              )
            }
            syncBusy={busyKey === 'sync'}
            onSync={() => {
              void runAction('sync', async () => {
                await postJson('/api/system/run-sync', { weekStart: data.weekStart })
              })
            }}
          />
        </PlannerHeader>

        {error ? <section className="error-banner">{error}</section> : null}

        <section className="content-stack route-stack route-stack-week">
          {pendingReviewCount > 0 ? (
            <Link {...navOptions.changes} className="review-callout review-callout-week no-underline">
              <div>
                <p className="eyebrow">Needs your attention</p>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  Review updates and long stays before you share this week.
                </p>
              </div>
              <span className="cleaner-chip">Open review</span>
            </Link>
          ) : null}

          <TeamAvailabilityCard
            cleaners={data.cleaners}
            weekCleanerAvailability={data.weekCleanerAvailability}
            weekLabel={availabilityWeekLabel}
            busy={availabilityBusy}
            onOpen={() => {
              setAvailabilitySuccess(null)
              setAvailabilityOpen(true)
            }}
          />

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
              if (availabilityBusy) {
                return
              }

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
                (current) =>
                  updateWeekAvailabilityOptimistically(current, {
                    cleanerId,
                    isAvailable,
                    date,
                  }),
              )
            }}
          />

          <WeeklyPlanPanel
            activeGroups={activeGroups}
            emptyGroups={emptyGroups}
            openDay={openDay}
            todayIso={todayIso}
            onToggleDay={toggleDay}
            onSelectAssignment={setEditingAssignment}
            onAddJob={(date) => {
              setManualJobDate(date)
              setManualJobSuccess(null)
              setManualJobOpen(true)
            }}
          />
        </section>

        <QuickEditSheet
          open={Boolean(editingAssignment)}
          title={editingAssignment ? `${editingAssignment.apartmentName} · ${formatDayLabel(editingAssignment.taskDate)}` : ''}
          deleteLabel={editingAssignment?.sourceManualRequestId ? 'Delete extra clean' : 'Remove clean from this week'}
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
