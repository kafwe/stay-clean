import { getRouteApi, useRouter } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { startTransition, useEffect, useState } from 'react'
import { MobileAppShell } from '#/components/MobileAppShell'
import { PlannerHeader } from '#/components/planner'
import { PdfExportButton } from '#/components/PdfExportButton'
import { formatDayLabel, shiftWeek, weekDates } from '#/lib/date'
import { postJson } from '#/lib/dashboard-page'
import { dashboardQueryOptions, useDashboardActionMutation } from '#/lib/dashboard-query'
import type { DashboardData } from '#/lib/types'
import { ManualJobPanel } from './components/ManualJobPanel'
import { ManualReviewPanel } from './components/ManualReviewPanel'
import { ReviewPanel } from './components/ReviewPanel'

const plannerRoute = getRouteApi('/_planner')

export function ReviewPage() {
  const search = plannerRoute.useSearch()
  const { data } = useSuspenseQuery(dashboardQueryOptions(search.week))
  const router = useRouter()
  const actionMutation = useDashboardActionMutation(search.week)
  const [manualDate, setManualDate] = useState('')
  const [manualApartmentId, setManualApartmentId] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manualSuccess, setManualSuccess] = useState<string | null>(null)
  const dateOptions = weekDates(data.weekStart)
  const pendingReviewCount = data.changeSets.length + data.manualReviews.length

  useEffect(() => {
    setManualDate((currentDate) => (dateOptions.includes(currentDate) ? currentDate : dateOptions[0] ?? ''))
  }, [data.weekStart, dateOptions])

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
        to: '/review',
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
        to: '/review',
        search: (prev) => ({
          ...prev,
          week: undefined,
        }),
      })
    })
  }

  return (
    <MobileAppShell
      activeTab="changes"
      weekStart={data.weekStart}
      pendingReviewCount={pendingReviewCount}
      floatingAction={
        <PdfExportButton
          weekLabel={data.weekLabel}
          weekStatus={data.weekStatus}
          dayGroups={data.dayGroups}
          variant="fab"
        />
      }
    >
      <div className="route-stage route-stage-review">
        <PlannerHeader
          eyebrow="Review queue"
          title={data.weekLabel}
          status={data.weekStatus}
          showThisWeekButton={Boolean(search.week)}
          onPrevious={() => moveWeek(-1)}
          onCurrent={jumpToCurrentWeek}
          onNext={() => moveWeek(1)}
        >
          <article className="overview-card overview-card-review">
            <div className="overview-copy">
              <p className="eyebrow">Ready for your decision</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--ink-strong)]">Approve updates, then share the week</h2>
              <div className="review-summary-strip">
                <span className="review-count-pill">
                  {data.changeSets.length} {data.changeSets.length === 1 ? 'change' : 'changes'} pending
                </span>
                <span className="review-count-pill subtle">
                  {data.manualReviews.length} {data.manualReviews.length === 1 ? 'stay to check' : 'stays to check'}
                </span>
              </div>
              <p className="review-emphasis-copy">
                Start with suggested updates, then add any extra cleans that still need to happen.
              </p>
            </div>
          </article>
        </PlannerHeader>

        {error ? <section className="error-banner">{error}</section> : null}

        <section className="content-stack route-stack route-stack-review">
          <ReviewPanel
            title="Suggested updates"
            emptyCopy="You are all caught up for this week."
            changeSets={data.changeSets}
            busyKey={busyKey}
            onApprove={(changeSetId) =>
              runAction(
                `approve-${changeSetId}`,
                async () => {
                  await postJson(`/api/suggestions/${changeSetId}/approve`)
                },
                undefined,
                (current) => ({
                  ...current,
                  changeSets: current.changeSets.filter((changeSet) => changeSet.id !== changeSetId),
                }),
              )
            }
            onReject={(changeSetId) =>
              runAction(
                `reject-${changeSetId}`,
                async () => {
                  await postJson(`/api/suggestions/${changeSetId}/reject`)
                },
                undefined,
                (current) => ({
                  ...current,
                  changeSets: current.changeSets.filter((changeSet) => changeSet.id !== changeSetId),
                }),
              )
            }
          />
          <ManualJobPanel
            apartments={data.apartments}
            dateOptions={dateOptions}
            taskDate={manualDate}
            apartmentId={manualApartmentId}
            busy={busyKey === 'add-manual'}
            successMessage={manualSuccess}
            onTaskDateChange={(value) => {
              setManualDate(value)
              if (manualSuccess) {
                setManualSuccess(null)
              }
            }}
            onApartmentChange={(value) => {
              setManualApartmentId(value)
              if (manualSuccess) {
                setManualSuccess(null)
              }
            }}
            onSubmit={() => {
              const selectedApartment = data.apartments.find((apartment) => apartment.id === manualApartmentId)
              const apartmentName = selectedApartment?.colloquialName ?? selectedApartment?.name ?? 'the selected home'

              void runAction(
                'add-manual',
                async () => {
                  await postJson('/api/setup/manual-cleans', {
                    taskDate: manualDate,
                    apartmentId: manualApartmentId || undefined,
                    isRecurring: false,
                    weekStart: data.weekStart,
                  })
                },
                () => {
                  setManualDate(dateOptions[0] ?? '')
                  setManualApartmentId('')
                  setManualSuccess(`Added a clean for ${apartmentName} on ${formatDayLabel(manualDate)}.`)
                },
              )
            }}
          />
          <ManualReviewPanel items={data.manualReviews} />
        </section>
      </div>
    </MobileAppShell>
  )
}
