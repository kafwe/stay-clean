import { getRouteApi, useRouter } from '@tanstack/react-router'
import { startTransition, useEffect, useState } from 'react'
import { AuthView } from '#/components/AuthView'
import { MobileAppShell } from '#/components/MobileAppShell'
import { PdfExportButton } from '#/components/PdfExportButton'
import { ManualJobPanel, ManualReviewPanel, ReviewPanel, WeekPanelHeader } from '#/components/WeekSections'
import { formatDayLabel, shiftWeek, weekDates } from '#/lib/date'
import { postJson } from '#/lib/dashboard-page'

const plannerRoute = getRouteApi('/_planner')

export function ReviewPage() {
  const data = plannerRoute.useLoaderData()
  const search = plannerRoute.useSearch()
  const router = useRouter()
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
        to: '/review',
        search: () => ({
          week: shiftWeek(data.weekStart, direction),
        }),
      })
    })
  }

  function jumpToCurrentWeek() {
    startTransition(() => {
      void router.navigate({
        to: '/review',
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
      activeTab="changes"
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
      <div className="route-stage route-stage-review">
        <WeekPanelHeader
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
        </WeekPanelHeader>

        {error ? <section className="error-banner">{error}</section> : null}

        <section className="content-stack route-stack route-stack-review">
          <ReviewPanel
            title="Suggested updates"
            emptyCopy="You are all caught up for this week."
            changeSets={data.changeSets}
            busyKey={busyKey}
            onApprove={(changeSetId) =>
              runAction(`approve-${changeSetId}`, async () => {
                await postJson(`/api/suggestions/${changeSetId}/approve`)
              })
            }
            onReject={(changeSetId) =>
              runAction(`reject-${changeSetId}`, async () => {
                await postJson(`/api/suggestions/${changeSetId}/reject`)
              })
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
