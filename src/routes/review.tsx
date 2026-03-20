import { createFileRoute, useRouter } from '@tanstack/react-router'
import { startTransition, useState } from 'react'
import { AuthView } from '#/components/AuthView'
import { MobileAppShell } from '#/components/MobileAppShell'
import { ManualReviewPanel, ReviewPanel, WeekPanelHeader } from '#/components/WeekSections'
import { shiftWeek } from '#/lib/date'
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
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    <MobileAppShell activeTab="changes" weekStart={data.weekStart}>
      <WeekPanelHeader
        eyebrow="Changes for this week"
        title={data.weekLabel}
        status={data.weekStatus}
        summaryItems={[
          `${data.changeSets.length} ${data.changeSets.length === 1 ? 'change' : 'changes'} waiting`,
          `${data.manualReviews.length} ${data.manualReviews.length === 1 ? 'stay' : 'stays'} to check`,
        ]}
        showThisWeekButton={Boolean(search.week)}
        onPrevious={() => moveWeek(-1)}
        onCurrent={jumpToCurrentWeek}
        onNext={() => moveWeek(1)}
      />

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
        <ManualReviewPanel items={data.manualReviews} />
      </section>
    </MobileAppShell>
  )
}
