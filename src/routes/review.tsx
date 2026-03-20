import { createFileRoute, useRouter } from '@tanstack/react-router'
import { startTransition, useEffect, useState } from 'react'
import { AuthView } from '#/components/AuthView'
import { MobileAppShell } from '#/components/MobileAppShell'
import { PdfExportButton } from '#/components/PdfExportButton'
import { ChangeRequestSheet, ManualJobPanel, ManualReviewPanel, ReviewPanel, WeekPanelHeader } from '#/components/WeekSections'
import { shiftWeek, weekDates } from '#/lib/date'
import { loadDashboard, postJson, weekSearchSchema } from '#/lib/dashboard-page'

export const Route = createFileRoute('/review')({
  validateSearch: weekSearchSchema,
  loaderDeps: ({ search }) => ({ weekStart: search.week }),
  loader: ({ deps }) => loadDashboard({ data: { weekStart: deps.weekStart } }),
  component: ReviewRoute,
})

function ReviewRoute() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [changeSheetOpen, setChangeSheetOpen] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [manualLabel, setManualLabel] = useState('')
  const [manualDate, setManualDate] = useState('')
  const [manualApartmentId, setManualApartmentId] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dateOptions = weekDates(data.weekStart)

  useEffect(() => {
    setManualDate((currentDate) => (dateOptions.includes(currentDate) ? currentDate : dateOptions[0] ?? ''))
  }, [data.weekStart, dateOptions])

  async function refresh() {
    startTransition(() => {
      router.invalidate()
    })
  }

  async function runAction(key: string, action: () => Promise<void>) {
    setBusyKey(key)
    setError(null)

    try {
      await action()
      await refresh()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong')
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
        password={password}
        setPassword={setPassword}
        busy={busyKey === 'login'}
        error={error}
        onSubmit={() => {
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
      <WeekPanelHeader
        eyebrow="Changes for this week"
        title={data.weekLabel}
        status={data.weekStatus}
        showThisWeekButton={Boolean(search.week)}
        onPrevious={() => moveWeek(-1)}
        onCurrent={jumpToCurrentWeek}
        onNext={() => moveWeek(1)}
      >
        <article className="overview-card">
          <div className="overview-copy">
            <p className="eyebrow">What needs review</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--ink-strong)]">
              {data.changeSets.length} {data.changeSets.length === 1 ? 'change' : 'changes'} waiting
            </h2>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              {data.manualReviews.length} {data.manualReviews.length === 1 ? 'long stay also needs' : 'long stays also need'} a quick check.
            </p>
          </div>
          <div className="overview-actions">
            <button type="button" className="action-ghost" onClick={() => setChangeSheetOpen(true)}>
              Ask for a change
            </button>
          </div>
        </article>
      </WeekPanelHeader>

      {error ? <section className="error-banner">{error}</section> : null}

      <section className="content-stack">
        <ReviewPanel
          title="Suggested changes"
          emptyCopy="No changes need your approval right now."
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
          label={manualLabel}
          taskDate={manualDate}
          apartmentId={manualApartmentId}
          busy={busyKey === 'add-manual'}
          onLabelChange={setManualLabel}
          onTaskDateChange={setManualDate}
          onApartmentChange={setManualApartmentId}
          onSubmit={() => {
            void runAction('add-manual', async () => {
              await postJson('/api/setup/manual-cleans', {
                label: manualLabel,
                taskDate: manualDate,
                apartmentId: manualApartmentId || undefined,
                isRecurring: false,
                weekStart: data.weekStart,
              })
              setManualLabel('')
              setManualDate(dateOptions[0] ?? '')
              setManualApartmentId('')
            })
          }}
        />
        <ManualReviewPanel items={data.manualReviews} />
      </section>

      <ChangeRequestSheet
        open={changeSheetOpen}
        weekLabel={data.weekLabel}
        message={chatMessage}
        busy={busyKey === 'chat'}
        dayGroups={data.dayGroups}
        changeSets={data.changeSets}
        onChange={setChatMessage}
        onClose={() => {
          if (busyKey === 'chat') {
            return
          }

          setChangeSheetOpen(false)
        }}
        onSubmit={() => {
          void runAction('chat', async () => {
            await postJson('/api/chat/propose', {
              message: chatMessage,
              weekStart: data.weekStart,
            })
            setChatMessage('')
            setChangeSheetOpen(false)
          })
        }}
      />
    </MobileAppShell>
  )
}
